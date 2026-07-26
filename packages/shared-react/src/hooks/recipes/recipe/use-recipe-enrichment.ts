import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

import type {
  RecipeEnrichmentKind,
  RecipeEnrichmentLifecycleEventDto,
  RecipeEnrichmentLifecycleState,
  RecipeEnrichmentStatusDto,
} from "@norish/shared/lib/recipe-enrichment";
import { ENRICHMENT_KINDS } from "@norish/shared/lib/recipe-enrichment";

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

const IDLE_STATES: RecipeEnrichmentStateMap = {
  "auto-tagging": "idle",
  "allergy-detection": "idle",
  "auto-categorization": "idle",
  "nutrition-estimation": "idle",
};

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
    }) as unknown as { queryKey: unknown[]; queryFn: () => Promise<RecipeEnrichmentStatusDto> };

    const { data, isLoading } = useQuery({
      queryKey: statusOptions.queryKey,
      queryFn: statusOptions.queryFn,
      enabled: !!recipeId,
      // Mount, refocus, and reconnect converge missed lifecycle events. No
      // interval: realtime carries the transitions.
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    });

    const states = useMemo<RecipeEnrichmentStateMap>(() => {
      const status = data as RecipeEnrichmentStatusDto | undefined;

      if (!status) return IDLE_STATES;

      const next = { ...IDLE_STATES };

      for (const entry of status.kinds) {
        next[entry.kind] = entry.state;
      }

      return next;
    }, [data]);

    /** Apply a lifecycle transition to the status cache without refetching. */
    const applyLifecycle = useCallback(
      (event: RecipeEnrichmentLifecycleEventDto) => {
        queryClient.setQueryData(
          statusOptions.queryKey,
          (current: RecipeEnrichmentStatusDto | undefined) => {
            const base =
              current ??
              ({
                recipeId: event.recipeId,
                kinds: ENRICHMENT_KINDS.map((kind) => ({
                  kind,
                  state: "idle" as RecipeEnrichmentLifecycleState,
                  origin: null,
                })),
              } satisfies RecipeEnrichmentStatusDto);

            return {
              ...base,
              kinds: base.kinds.map((entry) =>
                entry.kind === event.kind
                  ? { ...entry, state: event.state, origin: event.origin }
                  : entry
              ),
            };
          }
        );
      },
      [queryClient, statusOptions.queryKey]
    );

    useSubscription(
      trpc.recipes.onEnrichment.subscriptionOptions(undefined, {
        enabled: !!recipeId,
        onData: ({ payload }: any) => {
          if (payload.recipeId !== recipeId) return;

          applyLifecycle(payload);

          // Only the requester of a manual run hears about its failure. Retained
          // failed status stays visible to everyone who can see the recipe.
          const isOwnManualFailure =
            payload.state === "failed" &&
            payload.origin === "manual" &&
            !!currentUserId &&
            payload.requestedByUserId === currentUserId;

          if (isOwnManualFailure) {
            callbacks.onManualError?.(payload.kind, new Error("Enrichment failed"));
          }
        },
      }) as never
    );

    const mutation = useMutation(
      trpc.recipes.requestEnrichment.mutationOptions({
        onError: (error: unknown, variables: { kind: RecipeEnrichmentKind }) => {
          callbacks.onManualError?.(variables.kind, error);
        },
      }) as never
    ) as { mutate: (input: { recipeId: string; kind: RecipeEnrichmentKind }) => void };

    const request = useCallback(
      (kind: RecipeEnrichmentKind) => {
        if (!recipeId) return;

        // Show the accepted state immediately; the queued lifecycle event
        // confirms it, and a rejection reverts through the status query.
        applyLifecycle({ recipeId, kind, state: "queued", origin: "manual" });
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
