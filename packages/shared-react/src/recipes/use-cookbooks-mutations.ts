"use client";

import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { createClientId } from "@norish/shared/lib/operation-helpers";
import { uploadForm } from "@norish/shared/lib/upload-form";

import type { CookbooksMutationsResult } from "./cookbook-types";
import {
  invalidateUnlessPreserved,
  shouldPreserveOptimisticUpdate,
} from "../offline/optimistic-updates";
import { useReader } from "../reader";
import { useTRPC } from "../trpc";
import { useCookbooksCacheHelpers } from "./use-cookbooks-cache";
import { useRecipeMutationErrorToast } from "./use-recipe-mutation-error-toast";

export function useCookbooksMutations(): CookbooksMutationsResult {
  const trpc = useTRPC();
  const {
    setAllCookbooksData,
    invalidate,
    invalidateCookbook,
    invalidateMembership,
    patchRecipeMembership,
    seedCookbook,
    seedCookbookMembers,
  } = useCookbooksCacheHelpers();
  // So a cookbook created Offline is the Reader's own rather than Orphaned (ADR-0027).
  const currentUserId = useReader().user?.id;

  // A queued write keeps its tentative state: there is nothing to refetch Offline, and refetching
  // would erase the change the reader can see (ADR-0009).
  const invalidateUnlessQueued = invalidateUnlessPreserved(invalidate);
  // A write the Outbox kept is saved, not failed; any other refusal is told to the reader.
  const showFailure = useRecipeMutationErrorToast();
  const tellRefusal = (operation: string) => (error: unknown) => {
    if (!shouldPreserveOptimisticUpdate(error)) showFailure(error, `cookbooks:${operation}`);
  };
  const updateMutation = useMutation(
    trpc.cookbooks.update.mutationOptions({
      onSuccess: (_data, { id }) => invalidateCookbook(id),
      onError: (error) => {
        invalidateUnlessQueued(error);
        tellRefusal("update")(error);
      },
    })
  );
  const { mutate: mutateUpdate } = updateMutation;
  const deleteMutation = useMutation(
    trpc.cookbooks.remove.mutationOptions({
      onError: (error) => {
        invalidateUnlessQueued(error);
        tellRefusal("remove")(error);
      },
    })
  );
  const { mutate: mutateDelete } = deleteMutation;
  const membershipMutation = useMutation(
    trpc.cookbooks.setMembership.mutationOptions({
      onSuccess: (_data, { cookbookId, recipeIds }) => {
        for (const recipeId of recipeIds) invalidateMembership(recipeId);
        invalidateCookbook(cookbookId);
        // Refetch the lists too: the patch cleared derived fields only the server can answer.
        invalidate();
      },
      onError: (error) => {
        invalidateUnlessQueued(error);
        tellRefusal("membership")(error);
      },
    })
  );
  const { mutate: mutateMembership } = membershipMutation;
  const uploadImageMutation = useMutation(trpc.cookbooks.uploadImage.mutationOptions());
  const { mutateAsync: mutateUploadImageAsync } = uploadImageMutation;
  // Settled here: per-call callbacks run only for the last of overlapping calls.
  const createMutation = useMutation(
    trpc.cookbooks.create.mutationOptions({
      onMutate: ({ id, title, recipeIds = [] }) => {
        if (!id) return undefined;

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
          memberCount: recipeIds.length,
          image: null,
          coverImages: [],
          // Everything a card derives from the members is left empty: the
          // echo brings the real answers, and guessing them here would put
          // numbers on screen that no member supports.
          memberTitles: [],
          memberTags: [],
          totalMinutes: null,
          minServings: null,
        };

        return { tentative };
      },
      onSuccess: (cookbook, { recipeIds = [] }, context) => {
        invalidate();
        for (const recipeId of recipeIds) invalidateMembership(recipeId);
        // Seeding the cookbook's own read opens its page straight away,
        // Offline included; the web client holds that read at the
        // offline cache's lifetime, so it is in the floor from the
        // moment it exists (ADR-0008).
        const seeded = cookbook ?? context?.tentative;

        if (seeded) seedCookbook(seeded);
      },
      onError: (error, { id, recipeIds = [] }, context) => {
        const tentative = context?.tentative;

        tellRefusal("create")(error);

        if (!shouldPreserveOptimisticUpdate(error) || !tentative) {
          invalidate();

          return;
        }

        // Queued: a tentative success carrying the id the server will honour on Replay.
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
        seedCookbook(tentative);
        seedCookbookMembers(tentative.id, recipeIds);
      },
    })
  );
  const { mutateAsync: mutateCreateAsync } = createMutation;

  const createCookbook = useCallback(
    ({ title, recipeIds = [] }: { title: string; recipeIds?: string[] }) => {
      // Minted here, so filing queued behind an Offline create still points
      // at the right cookbook once replayed (ADR-0003).
      const id = createClientId();

      return mutateCreateAsync({ id, title, recipeIds }).then(
        () => id,
        // A refusal was told to the reader by the mutation's `onError`.
        (error: unknown) => (shouldPreserveOptimisticUpdate(error) ? id : undefined)
      );
    },
    [mutateCreateAsync]
  );

  /**
   * File recipes into a cookbook, or take them out. The same call both ways,
   * so undoing a mistake is not a hunt for a different control.
   *
   * The toggle is applied tentatively — including the member count, which is
   * what the card shows — and reconciled by the server's echo. A queued
   * mutation keeps the tentative state rather than snapping back (ADR-0009).
   *
   * Taking a recipe out also drops everything the card derives from the
   * members, because none of it can be recomputed here: which of the cover
   * images was the departing recipe's, which name to strike from the
   * description, how much of the total time was its, and what the smallest
   * serving count is once it is gone are all answers that need the members
   * themselves. Showing an emptier card until the echo lands is honest;
   * leaving a description that names a recipe the cookbook no longer holds
   * is not — and Offline that echo does not come at all.
   */
  const setMembership = useCallback(
    ({
      cookbookId,
      recipeIds,
      isMember,
      cookbook,
    }: {
      cookbookId: string;
      recipeIds: string[];
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
                memberCount: Math.max(
                  0,
                  entry.memberCount + (isMember ? recipeIds.length : -recipeIds.length)
                ),
                // Filing keeps them: every member they describe is still in
                // here, so they are merely incomplete until the echo adds the
                // newcomer. Unfiling cannot say that.
                ...(isMember
                  ? {}
                  : {
                      coverImages: [],
                      memberTitles: [],
                      memberTags: [],
                      totalMinutes: null,
                      minServings: null,
                    }),
              };

              patched = next;

              return next;
            }),
          })),
        };
      });

      if (patched) {
        for (const recipeId of recipeIds) patchRecipeMembership(recipeId, patched, isMember);
      }

      mutateMembership({ cookbookId, recipeIds, isMember });
    },
    [mutateMembership, setAllCookbooksData, patchRecipeMembership]
  );

  const updateCookbook = useCallback(
    ({
      id,
      title,
      image,
      version,
    }: {
      id: string;
      title: string;
      image?: string | null;
      version: number;
    }) => {
      setAllCookbooksData((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          pages: prev.pages.map((page) => ({
            ...page,
            cookbooks: page.cookbooks.map((cookbook) =>
              cookbook.id === id
                ? { ...cookbook, title, ...(image === undefined ? {} : { image }) }
                : cookbook
            ),
          })),
        };
      });

      mutateUpdate({ id, title, image, version });
    },
    [mutateUpdate, setAllCookbooksData]
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

      mutateDelete({ id, version });
    },
    [mutateDelete, setAllCookbooksData]
  );

  /** Store a cover and resolve with the URL an `updateCookbook` can save. */
  const uploadCookbookImage = useCallback(
    async (cookbookId: string, file: Blob) => {
      const result = await mutateUploadImageAsync(uploadForm({ cookbookId, image: file }));

      if (!result.success) throw new Error(result.error);

      return result.url;
    },
    [mutateUploadImageAsync]
  );

  return {
    createCookbook,
    updateCookbook,
    uploadCookbookImage,
    deleteCookbook,
    setMembership,
    isCreating: createMutation.isPending,
  };
}
