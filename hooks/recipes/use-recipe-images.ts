"use client";

import { useMutation } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export type RecipeImagesResult = {
  uploadImage: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  deleteImage: (url: string) => Promise<{ success: boolean; error?: string }>;
  uploadStepImage: (
    file: File,
    recipeId: string
  ) => Promise<{ success: boolean; url?: string; error?: string }>;
  deleteStepImage: (url: string) => Promise<{ success: boolean; error?: string }>;
  isUploadingImage: boolean;
  isDeletingImage: boolean;
  isUploadingStepImage: boolean;
  isDeletingStepImage: boolean;
};

export function useRecipeImages(): RecipeImagesResult {
  const trpc = useTRPC();

  const uploadImageMutation = useMutation(trpc.recipes.uploadImage.mutationOptions());
  const deleteImageMutation = useMutation(trpc.recipes.deleteImage.mutationOptions());
  const uploadStepImageMutation = useMutation(trpc.recipes.uploadStepImage.mutationOptions());
  const deleteStepImageMutation = useMutation(trpc.recipes.deleteStepImage.mutationOptions());

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    return await uploadImageMutation.mutateAsync(formData);
  };

  const deleteImage = async (url: string) => {
    return await deleteImageMutation.mutateAsync({ url });
  };

  const uploadStepImage = async (file: File, recipeId: string) => {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("recipeId", recipeId);
    return await uploadStepImageMutation.mutateAsync(formData);
  };

  const deleteStepImage = async (url: string) => {
    return await deleteStepImageMutation.mutateAsync({ url });
  };

  return {
    uploadImage,
    deleteImage,
    uploadStepImage,
    deleteStepImage,
    isUploadingImage: uploadImageMutation.isPending,
    isDeletingImage: deleteImageMutation.isPending,
    isUploadingStepImage: uploadStepImageMutation.isPending,
    isDeletingStepImage: deleteStepImageMutation.isPending,
  };
}
