import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";

import { createClientId } from "@norish/shared/lib/operation-helpers";

import type {
  CookbooksCacheHelpers,
  CookbooksMutationsResult,
  CreateCookbookHooksOptions,
} from "./types";
import { invalidateUnlessPreserved, shouldPreserveOptimisticUpdate } from "../optimistic-updates";

type Dependencies = CreateCookbookHooksOptions & {
  useCookbooksCacheHelpers: () => CookbooksCacheHelpers;
};

export function createUseCookbooksMutations({
  useTRPC,
  shouldPreserveOptimisticUpdate: preserve,
  useCookbooksCacheHelpers,
}: Dependencies) {
  return function useCookbooksMutations(): CookbooksMutationsResult {
    const trpc = useTRPC();
    const { setAllCookbooksData, invalidate, invalidateCookbook } = useCookbooksCacheHelpers();

    const createMutation = useMutation(trpc.cookbooks.create.mutationOptions());
    const renameMutation = useMutation(trpc.cookbooks.rename.mutationOptions());
    const deleteMutation = useMutation(trpc.cookbooks.remove.mutationOptions());

    const invalidateUnlessQueued = invalidateUnlessPreserved(invalidate, preserve);

    const createCookbook = useCallback(
      ({ title }: { title: string }) => {
        // Minted here, so filing queued behind an Offline create still points
        // at the right cookbook once replayed (ADR-0003).
        const id = createClientId();

        return new Promise<string>((resolve, reject) => {
          createMutation.mutate(
            { id, title },
            {
              onSuccess: () => {
                invalidate();
                resolve(id);
              },
              onError: (error) => {
                if (shouldPreserveOptimisticUpdate(error, preserve)) {
                  // Queued: a tentative success carrying the id the server
                  // will honour on Replay.
                  setAllCookbooksData((prev) => {
                    if (!prev?.pages?.length) return prev;

                    const [first, ...rest] = prev.pages;

                    if (!first) return prev;
                    if (first.cookbooks.some((cookbook) => cookbook.id === id)) return prev;

                    const now = new Date();

                    return {
                      ...prev,
                      pages: [
                        {
                          ...first,
                          total: first.total + 1,
                          cookbooks: [
                            {
                              id,
                              userId: null,
                              title,
                              createdAt: now,
                              updatedAt: now,
                              version: 1,
                              memberCount: 0,
                              coverImages: [],
                            },
                            ...first.cookbooks,
                          ],
                        },
                        ...rest,
                      ],
                    };
                  });
                  resolve(id);

                  return;
                }

                invalidate();
                reject(error);
              },
            }
          );
        });
      },
      [createMutation, invalidate, setAllCookbooksData, preserve]
    );

    const renameCookbook = useCallback(
      ({ id, title, version }: { id: string; title: string; version: number }) => {
        setAllCookbooksData((prev) => {
          if (!prev) return prev;

          return {
            ...prev,
            pages: prev.pages.map((page) => ({
              ...page,
              cookbooks: page.cookbooks.map((cookbook) =>
                cookbook.id === id ? { ...cookbook, title } : cookbook
              ),
            })),
          };
        });

        renameMutation.mutate(
          { id, title, version },
          {
            onSuccess: () => invalidateCookbook(id),
            onError: invalidateUnlessQueued,
          }
        );
      },
      [renameMutation, setAllCookbooksData, invalidateCookbook, invalidateUnlessQueued]
    );

    const deleteCookbook = useCallback(
      ({ id, version }: { id: string; version: number }) => {
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

        deleteMutation.mutate({ id, version }, { onError: invalidateUnlessQueued });
      },
      [deleteMutation, setAllCookbooksData, invalidateUnlessQueued]
    );

    return {
      createCookbook,
      renameCookbook,
      deleteCookbook,
      isCreating: createMutation.isPending,
    };
  };
}
