"use client";

import { useRecipeImages as useSharedRecipeImages } from "@norish/shared-react/recipes";
import { uploadForm } from "@norish/shared/lib/upload-form";

type RecipeImagesResult = {
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

  const uploadImage = (file: File) => uploadImageData(uploadForm({ image: file }));

  const uploadStepImage = (file: File, recipeId: string) =>
    uploadStepImageData(uploadForm({ image: file, recipeId }));

  const uploadGalleryImage = (file: File, recipeId: string, order?: number) =>
    uploadGalleryImageData(uploadForm({ image: file, recipeId, order }));

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
