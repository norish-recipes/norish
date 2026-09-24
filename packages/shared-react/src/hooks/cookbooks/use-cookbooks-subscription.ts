import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { CookbooksRealtime } from "@norish/shared/contracts/realtime/cookbooks";

import type { CookbooksCacheHelpers, CreateCookbookHooksOptions } from "./types";
import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";

type Payload<E extends EventName<CookbooksRealtime>> = PayloadOf<CookbooksRealtime, E>;

type Dependencies = CreateCookbookHooksOptions & {
  useCookbooksCacheHelpers: () => CookbooksCacheHelpers;
};

/**
 * Cookbook echoes, applied to every cached list.
 *
 * There is no echo suppression here: a cookbook's member count and derived
 * cover are computed per reader on the server, so the actor wants its own
 * echo back rather than holding a locally guessed one.
 */
export function createUseCookbooksSubscription({
  useTRPC,
  useCookbooksCacheHelpers,
}: Dependencies) {
  return function useCookbooksSubscription() {
    const trpc = useTRPC();
    const { setAllCookbooksData, invalidate, invalidateCookbook, invalidateMembership } =
      useCookbooksCacheHelpers();

    const lag = { onLag: invalidate };

    useRealtimeSubscription<Payload<"created">>(trpc.cookbooks.onCreated, {
      ...lag,
      // A new cookbook belongs wherever the reader's sort puts it, which is
      // not something a client can decide — refetch rather than guess.
      onEvent: () => invalidate(),
    });

    useRealtimeSubscription<Payload<"updated">>(trpc.cookbooks.onUpdated, {
      ...lag,
      onEvent: ({ cookbook }) => {
        setAllCookbooksData((prev) => {
          if (!prev) return prev;

          return {
            ...prev,
            pages: prev.pages.map((page) => ({
              ...page,
              cookbooks: page.cookbooks.map((current) =>
                current.id === cookbook.id ? { ...current, ...cookbook } : current
              ),
            })),
          };
        });
        invalidateCookbook(cookbook.id);
      },
    });

    useRealtimeSubscription<Payload<"membershipChanged">>(trpc.cookbooks.onMembershipChanged, {
      ...lag,
      onEvent: ({ recipeId, cookbookId }) => {
        // The member count and the derived cover are computed per reader on
        // the server, so a membership change is a refetch rather than a
        // local guess.
        invalidateMembership(recipeId);
        invalidateCookbook(cookbookId);
        invalidate();
      },
    });

    useRealtimeSubscription<Payload<"deleted">>(trpc.cookbooks.onDeleted, {
      ...lag,
      onEvent: ({ id }) => {
        setAllCookbooksData((prev) => {
          if (!prev) return prev;

          return {
            ...prev,
            pages: prev.pages.map((page) => {
              const kept = page.cookbooks.filter((cookbook) => cookbook.id !== id);

              return {
                ...page,
                cookbooks: kept,
                total: Math.max(0, page.total - (page.cookbooks.length - kept.length)),
              };
            }),
          };
        });
      },
    });
  };
}
