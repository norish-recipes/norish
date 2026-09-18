"use client";

import { useCallback, useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  IngredientDetailsCreateDto,
  IngredientDetailsUpdateDto,
} from "@norish/shared/contracts";

/**
 * Ingredient Name administration writes (ADR-0037).
 *
 * Every one of them invalidates rather than patching the cache: a picture
 * changes what the editor, the grocery list and every open recipe show, and a
 * rename changes the text of every recipe using the name.
 */
export function useIngredientsAdminMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // Stable keys keep `invalidate` stable, so a caller polling with it does not
  // restart its timer on every render.
  const keys = useMemo(
    () => ({
      list: trpc.admin.ingredients.list.pathKey(),
      names: trpc.ingredients.list.queryKey(),
      missing: trpc.admin.ingredients.missingImageCount.queryKey(),
      recipes: trpc.recipes.get.queryKey(),
    }),
    [trpc]
  );

  const createMutation = useMutation(trpc.admin.ingredients.create.mutationOptions());
  const updateMutation = useMutation(trpc.admin.ingredients.update.mutationOptions());
  const deleteMutation = useMutation(trpc.admin.ingredients.delete.mutationOptions());
  const uploadMutation = useMutation(trpc.admin.ingredients.uploadImage.mutationOptions());
  const removeImageMutation = useMutation(trpc.admin.ingredients.removeImage.mutationOptions());
  const generateMutation = useMutation(trpc.admin.ingredients.generateImage.mutationOptions());
  const generateMissingMutation = useMutation(
    trpc.admin.ingredients.generateMissing.mutationOptions()
  );

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.list }),
      queryClient.invalidateQueries({ queryKey: keys.names }),
      queryClient.invalidateQueries({ queryKey: keys.missing }),
      // Recipe lines carry their picture and name with them, so open recipes refetch too.
      queryClient.invalidateQueries({ queryKey: keys.recipes }),
    ]);
  }, [queryClient, keys]);

  const create = useCallback(
    async (input: IngredientDetailsCreateDto) => {
      const created = await createMutation.mutateAsync(input);

      await invalidate();

      return created;
    },
    [createMutation, invalidate]
  );

  const update = useCallback(
    async (input: IngredientDetailsUpdateDto) => {
      const updated = await updateMutation.mutateAsync(input);

      await invalidate();

      return updated;
    },
    [updateMutation, invalidate]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync({ id });
      await invalidate();
    },
    [deleteMutation, invalidate]
  );

  const uploadImage = useCallback(
    async (id: string, file: File) => {
      const formData = new FormData();

      formData.append("id", id);
      formData.append("image", file);

      // The router validates FormData at runtime but exposes a portable
      // structural upload input type for declaration emit.
      const result = await uploadMutation.mutateAsync(
        formData as unknown as Parameters<typeof uploadMutation.mutateAsync>[0]
      );

      await invalidate();

      return result;
    },
    [uploadMutation, invalidate]
  );

  const removeImage = useCallback(
    async (id: string) => {
      await removeImageMutation.mutateAsync({ id });
      await invalidate();
    },
    [removeImageMutation, invalidate]
  );

  const generateImage = useCallback(
    async (id: string) => await generateMutation.mutateAsync({ id }),
    [generateMutation]
  );

  const generateMissing = useCallback(
    async () => await generateMissingMutation.mutateAsync(),
    [generateMissingMutation]
  );

  return {
    create,
    update,
    remove,
    uploadImage,
    removeImage,
    generateImage,
    generateMissing,
    invalidate,
    isSaving: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    isChangingImage: uploadMutation.isPending || removeImageMutation.isPending,
  };
}
