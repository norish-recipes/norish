"use client";

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RecipesRealtime } from "@norish/shared/contracts/realtime/recipes";
import type {
  RecipeEnrichmentKind,
  RecipeEnrichmentLifecycleEventDto,
  RecipeEnrichmentLifecycleState,
  RecipeEnrichmentStatusDto,
} from "@norish/shared/lib/recipe-enrichment";
import {
  ENRICHMENT_KINDS,
  isRecipeEnrichmentLifecycleEvent,
} from "@norish/shared/lib/recipe-enrichment";

import { useReader } from "../reader";
import { useKeepsCurrent, useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";

export type RecipeEnrichmentStateMap = Record<RecipeEnrichmentKind, RecipeEnrichmentLifecycleState>;

export interface RecipeEnrichmentResult {
  /** Lifecycle state per kind. Always every kind, so callers never handle "unknown". */
  states: RecipeEnrichmentStateMap;
  /** True while that kind is queued or processing, which is when its action is disabled. */
  isBusy: (kind: RecipeEnrichmentKind) => boolean;
  /** Request one kind. Enrollment rejections surface through onManualError. */
  request: (kind: RecipeEnrichmentKind) => void;
  isLoading: boolean;
}

export interface RecipeEnrichmentCallbacks {
  /**
   * Called for a manual enqueue rejection or a manual terminal failure.
   * Automatic failures never call this: quiet background work must not look
   * like an operation the user started.
   */
  onManualError?: (kind: RecipeEnrichmentKind, error: unknown) => void;
}

export interface EnrichmentRequestInput {
  recipeId: string;
  kind: RecipeEnrichmentKind;
}

type EnrichmentMutation = { mutate: (input: EnrichmentRequestInput) => void };

const IDLE_STATES: RecipeEnrichmentStateMap = {
  "auto-tagging": "idle",
  "allergy-detection": "idle",
  "auto-categorization": "idle",
  "nutrition-estimation": "idle",
  "recipe-provenance": "idle",
  "ingredient-linking": "idle",
  "image-generation": "idle",
};

const STATE_FRESHNESS: Record<RecipeEnrichmentLifecycleState, number> = {
  idle: 0,
  queued: 1,
  processing: 2,
  succeeded: 3,
  failed: 3,
};

/**
 * Reconcile a query that started before a lifecycle event.
 *
 * The response may still contain useful state newer than that event, so compare
 * run ordering and same-run transition progress instead of discarding it whole.
 */
function reconcileStatusAfterLifecycle(
  current: RecipeEnrichmentStatusDto | undefined,
  incoming: RecipeEnrichmentStatusDto,
  changedKinds: ReadonlySet<RecipeEnrichmentKind>
): RecipeEnrichmentStatusDto {
  if (!current || current.recipeId !== incoming.recipeId) return incoming;

  const currentByKind = new Map(current.kinds.map((entry) => [entry.kind, entry]));

  return {
    ...incoming,
    kinds: incoming.kinds.map((incomingEntry) => {
      if (!changedKinds.has(incomingEntry.kind)) return incomingEntry;

      const currentEntry = currentByKind.get(incomingEntry.kind);

      if (!currentEntry) return incomingEntry;

      const currentIsUnorderedOptimistic =
        currentEntry.runId?.startsWith("optimistic:") && currentEntry.runSequence === null;

      if (currentIsUnorderedOptimistic) return currentEntry;
      if (currentEntry.runSequence === null) return incomingEntry;
      if (incomingEntry.runSequence === null) return currentEntry;
      if (incomingEntry.runSequence > currentEntry.runSequence) return incomingEntry;
      if (incomingEntry.runSequence < currentEntry.runSequence) return currentEntry;
      if (incomingEntry.runId !== currentEntry.runId) return currentEntry;

      return STATE_FRESHNESS[incomingEntry.state] > STATE_FRESHNESS[currentEntry.state]
        ? incomingEntry
        : currentEntry;
    }),
  };
}

/**
 * Apply a lifecycle transition to the status cache without refetching; true when
 * it changed the kind's entry.
 */
function applyLifecycle(
  queryClient: QueryClient,
  statusKey: QueryKey,
  event: RecipeEnrichmentLifecycleEventDto,
  allowQueuedReset = false
): boolean {
  let applied = false;

  queryClient.setQueryData(statusKey, (current: RecipeEnrichmentStatusDto | undefined) => {
    const base =
      current ??
      ({
        recipeId: event.recipeId,
        kinds: ENRICHMENT_KINDS.map((kind) => ({
          kind,
          state: "idle" as RecipeEnrichmentLifecycleState,
          origin: null,
          runId: null,
          runSequence: null,
        })),
      } satisfies RecipeEnrichmentStatusDto);

    return {
      ...base,
      kinds: base.kinds.map((entry) => {
        if (entry.kind !== event.kind) return entry;

        const isOptimisticRun = entry.runId?.startsWith("optimistic:") ?? false;

        // A manual optimistic transition preserves the previous run's
        // sequence. Only a strictly newer server run may replace it.
        if (
          !allowQueuedReset &&
          isOptimisticRun &&
          entry.runSequence !== null &&
          event.runSequence <= entry.runSequence
        ) {
          return entry;
        }

        // Run sequences are allocated atomically in Valkey. A terminal
        // event from an older run may arrive after the next run queues;
        // never let it replace the newer cache entry or trigger feedback.
        if (
          !allowQueuedReset &&
          entry.runSequence !== null &&
          (event.runSequence < entry.runSequence ||
            (event.runSequence === entry.runSequence && entry.runId !== event.runId))
        ) {
          return entry;
        }

        // The producer announces queued after durable enrollment without
        // awaiting realtime delivery. If a faster worker transition won
        // the race, never regress that cache entry back to queued. A
        // local manual request explicitly opts into the queued reset.
        if (
          event.state === "queued" &&
          entry.state !== "idle" &&
          entry.runId === event.runId &&
          !allowQueuedReset
        ) {
          return entry;
        }

        applied = true;

        return {
          ...entry,
          state: event.state,
          origin: event.origin,
          runId: event.runId,
          runSequence: allowQueuedReset ? entry.runSequence : event.runSequence,
        };
      }),
    };
  });

  return applied;
}

/** The kinds whose cached entry another write replaced since `before` was read. */
function kindsChangedSince(
  before: RecipeEnrichmentStatusDto | undefined,
  after: RecipeEnrichmentStatusDto | undefined
): Set<RecipeEnrichmentKind> {
  const beforeByKind = new Map(before?.kinds.map((entry) => [entry.kind, entry]));

  return new Set(
    (after?.kinds ?? [])
      .filter((entry) => beforeByKind.get(entry.kind) !== entry)
      .map((entry) => entry.kind)
  );
}

/**
 * One hook for every Recipe Enrichment kind: its states and its requests.
 *
 * The combined status query is the authoritative initial and recovery read;
 * `useRecipeEnrichmentSubscription`, mounted once by the page, writes lifecycle
 * events into that cache, so a success needs no refetch and there is no polling.
 * `onManualError` here hears a rejected request.
 */
export function useRecipeEnrichment(
  recipeId: string | null,
  callbacks: RecipeEnrichmentCallbacks = {}
): RecipeEnrichmentResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const statusOptions = trpc.recipes.enrichmentStatus.queryOptions({
    recipeId: recipeId ?? "",
  });
  const statusKey = statusOptions.queryKey;

  const { data, isLoading } = useQuery({
    ...statusOptions,
    enabled: !!recipeId,
    queryFn: async (context) => {
      // Lifecycle events and requests replace a kind's entry, so an entry that
      // changed while this read was out is newer than its answer may be.
      const atStart = queryClient.getQueryData<RecipeEnrichmentStatusDto>(statusKey);

      if (typeof statusOptions.queryFn !== "function") {
        throw new Error("Recipe Enrichment status query is unavailable");
      }

      const incoming = await statusOptions.queryFn(context);
      const current = queryClient.getQueryData<RecipeEnrichmentStatusDto>(statusKey);
      const changedKinds = kindsChangedSince(atStart, current);

      if (changedKinds.size === 0) return incoming;

      return reconcileStatusAfterLifecycle(current, incoming, changedKinds);
    },
    // Mount, refocus, and reconnect converge missed lifecycle events. No
    // interval: realtime carries the transitions.
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const states = useMemo<RecipeEnrichmentStateMap>(() => {
    const status = data;

    if (!status) return IDLE_STATES;

    const next = { ...IDLE_STATES };

    for (const entry of status.kinds) {
      next[entry.kind] = entry.state;
    }

    return next;
  }, [data]);

  const mutation: EnrichmentMutation = useMutation(
    trpc.recipes.requestEnrichment.mutationOptions({
      onError: (error: unknown, variables: EnrichmentRequestInput) => {
        // The optimistic `queued` never happened: put the kind back where the
        // server says it is, so a rejected request cannot leave the action
        // disabled until the next refocus.
        void queryClient.invalidateQueries({ queryKey: statusKey });
        callbacks.onManualError?.(variables.kind, error);
      },
    })
  );
  const { mutate: mutateMutation } = mutation;

  const request = useCallback(
    (kind: RecipeEnrichmentKind) => {
      if (!recipeId) return;

      // Show the accepted state immediately; the queued lifecycle event
      // confirms it, and a rejection reverts through the status query.
      applyLifecycle(
        queryClient,
        statusKey,
        {
          recipeId,
          runId: `optimistic:${recipeId}:${kind}`,
          runSequence: 0,
          kind,
          state: "queued",
          origin: "manual",
        },
        true
      );
      mutateMutation({ recipeId, kind });
    },
    [recipeId, mutateMutation, queryClient, statusKey]
  );

  const isBusy = useCallback(
    (kind: RecipeEnrichmentKind) => states[kind] === "queued" || states[kind] === "processing",
    [states]
  );

  return { states, isBusy, request, isLoading };
}

/**
 * A recipe's enrichment lifecycle events, written into its status cache. Mounted
 * once per page, so each event is applied and each failure reported once;
 * `onManualError` hears the reader's own manual runs that failed.
 */
export function useRecipeEnrichmentSubscription(
  recipeId: string | null,
  callbacks: RecipeEnrichmentCallbacks = {}
): void {
  const trpc = useTRPC();
  const currentUserId = useReader().user?.id;
  const queryClient = useQueryClient();
  const statusKey = trpc.recipes.enrichmentStatus.queryKey({ recipeId: recipeId ?? "" });

  useKeepsCurrent(recipeId ? [statusKey] : []);

  useRealtimeSubscription<PayloadOf<RecipesRealtime, "enrichment">>(trpc.recipes.onEnrichment, {
    enabled: !!recipeId,
    // The status query is the recovery read: a lagged subscription refetches it.
    lagQueryKeys: [statusKey],
    // A fresh subscription carries no cursor, so a transition between the
    // first read and the server taking the subscription reaches nobody: a run
    // that finished then would show as in progress until the next refocus.
    onStarted: () => void queryClient.invalidateQueries({ queryKey: statusKey }),
    onEvent: (payload) => {
      // The catalogue declares this payload with `z.custom`, which validates
      // nothing at runtime yet, so the shape is still checked here.
      if (!isRecipeEnrichmentLifecycleEvent(payload) || payload.recipeId !== recipeId) return;

      const applied = applyLifecycle(queryClient, statusKey, payload);

      // Only the requester of a manual run hears about its failure. Retained
      // failed status stays visible to everyone who can see the recipe.
      const isOwnManualFailure =
        payload.state === "failed" &&
        payload.origin === "manual" &&
        !!currentUserId &&
        payload.requestedByUserId === currentUserId;

      if (applied && isOwnManualFailure) {
        callbacks.onManualError?.(payload.kind, new Error("Enrichment failed"));
      }
    },
  });
}
