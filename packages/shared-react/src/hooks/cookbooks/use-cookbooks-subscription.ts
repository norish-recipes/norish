import { useSubscription } from "@trpc/tanstack-react-query";

import type { CookbooksCacheHelpers, CreateCookbookHooksOptions } from "./types";

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
    const { setAllCookbooksData, invalidate, invalidateCookbook } = useCookbooksCacheHelpers();

    useSubscription(
      trpc.cookbooks.onCreated.subscriptionOptions(undefined, {
        // A new cookbook belongs wherever the reader's sort puts it, which is
        // not something a client can decide — refetch rather than guess.
        onData: () => invalidate(),
      })
    );

    useSubscription(
      trpc.cookbooks.onUpdated.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setAllCookbooksData((prev) => {
            if (!prev) return prev;

            return {
              ...prev,
              pages: prev.pages.map((page) => ({
                ...page,
                cookbooks: page.cookbooks.map((cookbook) =>
                  cookbook.id === payload.cookbook.id
                    ? { ...cookbook, ...payload.cookbook }
                    : cookbook
                ),
              })),
            };
          });
          invalidateCookbook(payload.cookbook.id);
        },
      })
    );

    useSubscription(
      trpc.cookbooks.onDeleted.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setAllCookbooksData((prev) => {
            if (!prev) return prev;

            return {
              ...prev,
              pages: prev.pages.map((page) => {
                const kept = page.cookbooks.filter((cookbook) => cookbook.id !== payload.id);

                return {
                  ...page,
                  cookbooks: kept,
                  total: Math.max(0, page.total - (page.cookbooks.length - kept.length)),
                };
              }),
            };
          });
        },
      })
    );
  };
}
