"use client";

import { sharedRecipeFamilyHooks } from "./shared-recipe-hooks";

export type RecipeVideosResult = {
  uploadGalleryVideo: (
    file: File,
    recipeId: string,
    order?: number,
    duration?: number
  ) => Promise<{
    success: boolean;
    url?: string;
    id?: string;
    duration?: number | null;
    thumbnail?: string | null;
    order?: number;
    version?: number;
    error?: string;
  }>;
  deleteGalleryVideo: (
    videoId: string,
    version: number
  ) => Promise<{ success: boolean; error?: string }>;
  isUploadingGalleryVideo: boolean;
  isDeletingGalleryVideo: boolean;
};

export function useRecipeVideos(): RecipeVideosResult {
  const {
    uploadGalleryVideoData,
    deleteGalleryVideo,
    isUploadingGalleryVideo,
    isDeletingGalleryVideo,
  } = sharedRecipeFamilyHooks.useRecipeVideos();

  const uploadGalleryVideo = async (
    file: File,
    recipeId: string,
    order?: number,
    duration?: number
  ) => {
    const formData = new FormData();

    formData.append("video", file);
    formData.append("recipeId", recipeId);
    if (order !== undefined) {
      formData.append("order", String(order));
    }
    if (duration !== undefined) {
      formData.append("duration", String(duration));
    }

    return await uploadGalleryVideoData(formData as Parameters<typeof uploadGalleryVideoData>[0]);
  };

  return {
    uploadGalleryVideo,
    deleteGalleryVideo,
    isUploadingGalleryVideo,
    isDeletingGalleryVideo,
  };
}
