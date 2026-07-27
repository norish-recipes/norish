import { useCallback, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

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

import type { CreateRecipeHooksOptions } from "../types";

export type RecipeEnrichmentStateMap = Record<RecipeEnrichmentKind, RecipeEnrichmentLifecycleState>;

export interface RecipeEnrichmentResult {
  /** Lifecycle state per kind. Always all four, so callers never handle "unknown". */
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

/**
 * Narrow a realtime frame to a lifecycle event.
 *
 * Subscriptions arrive typed as `unknown` because the envelope wrapper is not
 * part of the generated router types, so this is where the shape is checked
 * rather than asserted.
 */
function asLifecycleEvent(data: unknown): RecipeEnrichmentLifecycleEventDto | null {
  const payload = (data as { payload?: unknown } | null)?.payload;

  return isRecipeEnrichmentLifecycleEvent(payload) ? payload : null;
}

type EnrichmentMutation = { mutate: (input: EnrichmentRequestInput) => void };

const IDLE_STATES: RecipeEnrichmentStateMap = {
  "auto-tagging": "idle",
  "allergy-detection": "idle",
  "auto-categorization": "idle",
  "nutrition-estimation": "idle",
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
 * One hook for all four Recipe Enrichment kinds.
 *
 * Replaces four near-identical query/subscription families. The combined status
 * query is the authoritative initial and recovery read; lifecycle events update
 * that cache directly, so a success needs no refetch and there is no polling.
 */
export function createUseRecipeEnrichment({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRecipeEnrichment(
    recipeId: string | null,
    currentUserId?: string | null,
    callbacks: RecipeEnrichmentCallbacks = {}
  ): RecipeEnrichmentResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const statusOptions = trpc.recipes.enrichmentStatus.queryOptions({
      recipeId: recipeId ?? "",
    });
    const statusKey = statusOptions.queryKey;
    const lifecycleVersions = useRef<Record<RecipeEnrichmentKind, number>>({
      "auto-tagging": 0,
      "allergy-detection": 0,
      "auto-categorization": 0,
      "nutrition-estimation": 0,
    });

    const { data, isLoading } = useQuery({
      ...statusOptions,
      enabled: !!recipeId,
      queryFn: async (context) => {
        const versionsAtStart = { ...lifecycleVersions.current };

        if (typeof statusOptions.queryFn !== "function") {
          throw new Error("Recipe Enrichment status query is unavailable");
        }

        const incoming = await statusOptions.queryFn(context);
        const changedKinds = new Set(
          ENRICHMENT_KINDS.filter(
            (kind) => versionsAtStart[kind] !== lifecycleVersions.current[kind]
          )
        );

        if (changedKinds.size === 0) return incoming;

        return reconcileStatusAfterLifecycle(
          queryClient.getQueryData<RecipeEnrichmentStatusDto>(statusKey),
          incoming,
          changedKinds
        );
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

    /** Apply a lifecycle transition to the status cache without refetching. */
    const applyLifecycle = useCallback(
      (event: RecipeEnrichmentLifecycleEventDto, allowQueuedReset = false) => {
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

              // Run sequences are allocated atomically in Redis. A terminal
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

        if (applied) lifecycleVersions.current[event.kind] += 1;

        return applied;
      },
      [queryClient, statusKey]
    );

    useSubscription(
      trpc.recipes.onEnrichment.subscriptionOptions(undefined, {
        enabled: !!recipeId,
        onData: (data: unknown) => {
          const payload = asLifecycleEvent(data);

          if (!payload || payload.recipeId !== recipeId) return;

          const applied = applyLifecycle(payload);

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
      })
    );

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

    const request = useCallback(
      (kind: RecipeEnrichmentKind) => {
        if (!recipeId) return;

        // Show the accepted state immediately; the queued lifecycle event
        // confirms it, and a rejection reverts through the status query.
        applyLifecycle(
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
        mutation.mutate({ recipeId, kind });
      },
      [recipeId, mutation, applyLifecycle]
    );

    const isBusy = useCallback(
      (kind: RecipeEnrichmentKind) => states[kind] === "queued" || states[kind] === "processing",
      [states]
    );

    return { states, isBusy, request, isLoading };
  };
}
