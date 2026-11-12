"use client";

import { useRecipeVideos as useSharedRecipeVideos } from "@norish/shared-react/recipes";
import { uploadForm } from "@norish/shared/lib/upload-form";

type RecipeVideosResult = {
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
  } = useSharedRecipeVideos();

  const uploadGalleryVideo = (file: File, recipeId: string, order?: number, duration?: number) =>
    uploadGalleryVideoData(uploadForm({ video: file, recipeId, order, duration }));

  return {
    uploadGalleryVideo,
    deleteGalleryVideo,
    isUploadingGalleryVideo,
    isDeletingGalleryVideo,
  };
}
