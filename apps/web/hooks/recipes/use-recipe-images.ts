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
  uploadGalleryImage: (
    file: File,
    recipeId: string,
    order?: number
  ) => Promise<{ success: boolean; url?: string; id?: string; order?: number; error?: string }>;
  deleteGalleryImage: (imageId: string) => Promise<{ success: boolean; error?: string }>;
  isUploadingImage: boolean;
  isDeletingImage: boolean;
  isUploadingStepImage: boolean;
  isDeletingStepImage: boolean;
  isUploadingGalleryImage: boolean;
  isDeletingGalleryImage: boolean;
};

export function useRecipeImages(): RecipeImagesResult {
  const trpc = useTRPC();

  const uploadImageMutation = useMutation(trpc.recipes.uploadImage.mutationOptions());
  const deleteImageMutation = useMutation(trpc.recipes.deleteImage.mutationOptions());
  const uploadStepImageMutation = useMutation(trpc.recipes.uploadStepImage.mutationOptions());
  const deleteStepImageMutation = useMutation(trpc.recipes.deleteStepImage.mutationOptions());
  const uploadGalleryImageMutation = useMutation(trpc.recipes.uploadGalleryImage.mutationOptions());
  const deleteGalleryImageMutation = useMutation(trpc.recipes.deleteGalleryImage.mutationOptions());

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

  const uploadGalleryImage = async (file: File, recipeId: string, order?: number) => {
    const formData = new FormData();

    formData.append("image", file);
    formData.append("recipeId", recipeId);
    if (order !== undefined) {
      formData.append("order", String(order));
    }

    return await uploadGalleryImageMutation.mutateAsync(formData);
  };

  const deleteGalleryImage = async (imageId: string) => {
    return await deleteGalleryImageMutation.mutateAsync({ imageId });
  };

  return {
    uploadImage,
    deleteImage,
    uploadStepImage,
    deleteStepImage,
    uploadGalleryImage,
    deleteGalleryImage,
    isUploadingImage: uploadImageMutation.isPending,
    isDeletingImage: deleteImageMutation.isPending,
    isUploadingStepImage: uploadStepImageMutation.isPending,
    isDeletingStepImage: deleteStepImageMutation.isPending,
    isUploadingGalleryImage: uploadGalleryImageMutation.isPending,
    isDeletingGalleryImage: deleteGalleryImageMutation.isPending,
  };
}
