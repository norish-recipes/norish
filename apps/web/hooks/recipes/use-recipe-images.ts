"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import { createUseRecipeImages } from "@norish/shared-react/hooks/recipes/recipe";

const useSharedRecipeImages = createUseRecipeImages({ useTRPC });

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
  ) => Promise<{
    success: boolean;
    url?: string;
    id?: string;
    order?: number;
    version?: number;
    error?: string;
  }>;
  deleteGalleryImage: (
    imageId: string,
    version: number
  ) => Promise<{ success: boolean; error?: string }>;
  isUploadingImage: boolean;
  isDeletingImage: boolean;
  isUploadingStepImage: boolean;
  isDeletingStepImage: boolean;
  isUploadingGalleryImage: boolean;
  isDeletingGalleryImage: boolean;
};

export function useRecipeImages(): RecipeImagesResult {
  const {
    uploadImageData,
    deleteImage,
    uploadStepImageData,
    deleteStepImage,
    uploadGalleryImageData,
    deleteGalleryImage,
    isUploadingImage,
    isDeletingImage,
    isUploadingStepImage,
    isDeletingStepImage,
    isUploadingGalleryImage,
    isDeletingGalleryImage,
  } = useSharedRecipeImages();

  const uploadImage = async (file: File) => {
    const formData = new FormData();

    formData.append("image", file);

    return await uploadImageData(formData as Parameters<typeof uploadImageData>[0]);
  };

  const uploadStepImage = async (file: File, recipeId: string) => {
    const formData = new FormData();

    formData.append("image", file);
    formData.append("recipeId", recipeId);

    return await uploadStepImageData(formData as Parameters<typeof uploadStepImageData>[0]);
  };

  const uploadGalleryImage = async (file: File, recipeId: string, order?: number) => {
    const formData = new FormData();

    formData.append("image", file);
    formData.append("recipeId", recipeId);
    if (order !== undefined) {
      formData.append("order", String(order));
    }

    return await uploadGalleryImageData(formData as Parameters<typeof uploadGalleryImageData>[0]);
  };

  return {
    uploadImage,
    deleteImage,
    uploadStepImage,
    deleteStepImage,
    uploadGalleryImage,
    deleteGalleryImage,
    isUploadingImage,
    isDeletingImage,
    isUploadingStepImage,
    isDeletingStepImage,
    isUploadingGalleryImage,
    isDeletingGalleryImage,
  };
}
