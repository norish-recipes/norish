import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { IngredientDraft } from "./types";
import { wentThrough } from "../offline/settled";
import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";
import { projectedMutation } from "../trpc/projected-mutation";
import { useCatalogueFailure } from "./use-catalogue-failure";
import { useIngredientCache } from "./use-ingredient-cache";

/**
 * An Ingredient's writes. Each shows in the cache the moment it is made; a refusal reads everything
 * again, which undoes the guess, and says why. Each resolves whether it went through.
 */
export function useIngredientMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = usePlatform();
  const cache = useIngredientCache();
  const { refuse } = useCatalogueFailure();

  const refused = (context: string) => ({
    onError: (error: unknown) => {
      void cache.rollback();
      refuse(error, context);
    },
    onSuccess: () => void cache.refreshLists(),
  });

  // The draft carries what the row shows (the parent's names, the icon's address) beside what is sent.
  const saveDraft = useMutation({
    ...projectedMutation(
      trpc.ingredients.saveDraft.mutationOptions(),
      (draft: IngredientDraft) => ({
        ingredientId: draft.ingredientId,
        ...(draft.name !== undefined ? { name: draft.name } : {}),
        ...(draft.parent !== undefined ? { parentId: draft.parent?.id ?? null } : {}),
        add: draft.add,
        remove: draft.remove,
        junk: draft.junk,
        ...(draft.icon !== undefined ? { icon: draft.icon?.file ?? null } : {}),
      })
    ),
    onMutate: (draft) =>
      cache.patchRow(draft.ingredientId, (row) => ({
        ...row,
        ...(draft.name !== undefined ? { name: draft.name } : {}),
        ...(draft.parent !== undefined
          ? { parent: draft.parent ? { ...draft.parent } : null }
          : {}),
        // A flagged food the reader filed by hand is settled by it.
        ...(draft.parent ? { flagged: false, flagReason: null } : {}),
        // A removed icon's fallback is the server's to say, on the read that follows.
        ...(draft.icon ? { icon: draft.icon.address, ownIcon: true } : {}),
        aliases: [
          ...row.aliases.filter((spelling) => !draft.remove.includes(spelling.id)),
          ...draft.add.map((text) => ({ id: `draft:${text}`, text, canRemove: true })),
        ],
      })),
    ...refused("save"),
    onSuccess: (_answer, draft) => {
      void cache.refreshLists();
      // Every surface showing this food, or a kind borrowing its icon, reads it again.
      if (draft.icon !== undefined) {
        void queryClient.invalidateQueries({ queryKey: trpc.ingredients.icons.pathKey() });
      }
    },
  });

  const markDistinct = useMutation(
    trpc.ingredients.markDistinct.mutationOptions({
      onMutate: ({ ingredientId }) =>
        cache.patchRow(ingredientId, (row) => ({ ...row, flagged: false, flagReason: null })),
      ...refused("mark-distinct"),
    })
  );

  const moveAlias = useMutation({
    ...projectedMutation(
      trpc.ingredients.moveAlias.mutationOptions(),
      (move: { ingredientId: string; aliasId: string; targetId: string | null }) => ({
        aliasId: move.aliasId,
        targetId: move.targetId,
      })
    ),
    onMutate: ({ ingredientId, aliasId }) =>
      cache.patchRow(ingredientId, (row) => ({
        ...row,
        aliases: row.aliases.filter((spelling) => spelling.id !== aliasId),
      })),
    ...refused("move-alias"),
  });

  const merge = useMutation({
    ...projectedMutation(
      trpc.ingredients.merge.mutationOptions(),
      (merge: { sourceId: string; targetId: string; name: string; into: string }) => ({
        sourceId: merge.sourceId,
        targetId: merge.targetId,
      })
    ),
    // Merged away, the food is gone; the toast says where it went and how to get it back.
    onMutate: ({ sourceId, name, into }) => {
      cache.dropRow(sourceId);
      toast.show({
        severity: "success",
        title: toast.translate("settings.ingredients.mergedToast", { name, into }),
      });
    },
    ...refused("merge"),
  });

  const remove = useMutation(
    trpc.ingredients.remove.mutationOptions({
      onMutate: ({ ingredientId }) => cache.dropRow(ingredientId),
      ...refused("delete"),
    })
  );

  return {
    saveDraft: (draft: IngredientDraft) => wentThrough(saveDraft.mutateAsync(draft)),
    markDistinct: (ingredientId: string) => wentThrough(markDistinct.mutateAsync({ ingredientId })),
    moveAlias: (ingredientId: string, aliasId: string, targetId: string | null) =>
      wentThrough(moveAlias.mutateAsync({ ingredientId, aliasId, targetId })),
    merge: (source: { id: string; name: string }, target: { id: string; name: string }) =>
      wentThrough(
        merge.mutateAsync({
          sourceId: source.id,
          targetId: target.id,
          name: source.name,
          into: target.name,
        })
      ),
    remove: (ingredientId: string) => wentThrough(remove.mutateAsync({ ingredientId })),
  };
}
