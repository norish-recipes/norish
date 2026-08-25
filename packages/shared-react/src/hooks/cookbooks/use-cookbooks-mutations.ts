import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
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
  usePromoteCreatedCookbook,
  useCurrentUserId,
  useCookbooksCacheHelpers,
}: Dependencies) {
  return function useCookbooksMutations(): CookbooksMutationsResult {
    const trpc = useTRPC();
    const promoteCreatedCookbook = usePromoteCreatedCookbook?.();
    const {
      setAllCookbooksData,
      invalidate,
      invalidateCookbook,
      invalidateMembership,
      patchRecipeMembership,
      seedCookbook,
    } = useCookbooksCacheHelpers();
    const currentUserId = useCurrentUserId?.();

    const createMutation = useMutation(trpc.cookbooks.create.mutationOptions());
    const renameMutation = useMutation(trpc.cookbooks.rename.mutationOptions());
    const deleteMutation = useMutation(trpc.cookbooks.remove.mutationOptions());
    const membershipMutation = useMutation(trpc.cookbooks.setMembership.mutationOptions());

    const invalidateUnlessQueued = invalidateUnlessPreserved(invalidate, preserve);

    const createCookbook = useCallback(
      ({ title, recipeId }: { title: string; recipeId?: string }) => {
        // Minted here, so filing queued behind an Offline create still points
        // at the right cookbook once replayed (ADR-0003).
        const id = createClientId();
        const now = new Date();
        // The owner is the caller: minting this as Orphaned would offer rename
        // and delete to everyone under every policy until the echo arrived
        // (ADR-0027).
        const tentative: CookbookSummaryDTO = {
          id,
          userId: currentUserId ?? null,
          title,
          createdAt: now,
          updatedAt: now,
          version: 1,
          memberCount: recipeId ? 1 : 0,
          coverImages: [],
        };

        /**
         * Seed the cookbook's own read and hold it at the offline cache's
         * lifetime, so it is in the guaranteed floor from the moment it exists
         * and its page opens straight away — Offline included (ADR-0008).
         * Promotion alone cannot do this: there is nothing to promote until
         * something has written the entry.
         */
        const adopt = (cookbook: CookbookSummaryDTO) => {
          seedCookbook(cookbook);
          promoteCreatedCookbook?.(cookbook.id);
        };

        return new Promise<string>((resolve, reject) => {
          createMutation.mutate(
            { id, title, recipeId },
            {
              onSuccess: (cookbook) => {
                invalidate();
                if (recipeId) invalidateMembership(recipeId);
                adopt(cookbook ?? tentative);
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

                    return {
                      ...prev,
                      pages: [
                        {
                          ...first,
                          total: first.total + 1,
                          cookbooks: [tentative, ...first.cookbooks],
                        },
                        ...rest,
                      ],
                    };
                  });
                  adopt(tentative);
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
      [
        createMutation,
        currentUserId,
        invalidate,
        invalidateMembership,
        setAllCookbooksData,
        seedCookbook,
        promoteCreatedCookbook,
        preserve,
      ]
    );

    /**
     * File a recipe into a cookbook, or take it out. The same call both ways,
     * so undoing a mistake is not a hunt for a different control.
     *
     * The toggle is applied tentatively — including the member count, which is
     * what the card shows — and reconciled by the server's echo. A queued
     * mutation keeps the tentative state rather than snapping back (ADR-0009).
     */
    const setMembership = useCallback(
      ({
        cookbookId,
        recipeId,
        isMember,
        cookbook,
      }: {
        cookbookId: string;
        recipeId: string;
        isMember: boolean;
        /** The row as the caller has it, for the tentative patch. */
        cookbook?: CookbookSummaryDTO;
      }) => {
        let patched: CookbookSummaryDTO | undefined = cookbook;

        setAllCookbooksData((prev) => {
          if (!prev) return prev;

          return {
            ...prev,
            pages: prev.pages.map((page) => ({
              ...page,
              cookbooks: page.cookbooks.map((entry) => {
                if (entry.id !== cookbookId) return entry;

                const next = {
                  ...entry,
                  memberCount: Math.max(0, entry.memberCount + (isMember ? 1 : -1)),
                };

                patched = next;

                return next;
              }),
            })),
          };
        });

        if (patched) {
          patchRecipeMembership(recipeId, patched, isMember);
        }

        membershipMutation.mutate(
          { cookbookId, recipeId, isMember },
          {
            onSuccess: () => {
              invalidateMembership(recipeId);
              invalidateCookbook(cookbookId);
            },
            // A queued filing keeps its tentative state: there is nothing to
            // refetch Offline, and refetching would erase the change the
            // reader can see (ADR-0009).
            onError: invalidateUnlessQueued,
          }
        );
      },
      [
        membershipMutation,
        setAllCookbooksData,
        patchRecipeMembership,
        invalidateMembership,
        invalidateCookbook,
        invalidateUnlessQueued,
      ]
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
      setMembership,
      isCreating: createMutation.isPending,
    };
  };
}
