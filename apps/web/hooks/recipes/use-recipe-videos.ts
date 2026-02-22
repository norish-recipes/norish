"use client";

import { useMutation } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

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
    error?: string;
  }>;
  deleteGalleryVideo: (videoId: string) => Promise<{ success: boolean; error?: string }>;
  isUploadingGalleryVideo: boolean;
  isDeletingGalleryVideo: boolean;
};

export function useRecipeVideos(): RecipeVideosResult {
  const trpc = useTRPC();

  const uploadGalleryVideoMutation = useMutation(trpc.recipes.uploadGalleryVideo.mutationOptions());
  const deleteGalleryVideoMutation = useMutation(trpc.recipes.deleteGalleryVideo.mutationOptions());

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

    return await uploadGalleryVideoMutation.mutateAsync(formData);
  };

  const deleteGalleryVideo = async (videoId: string) => {
    return await deleteGalleryVideoMutation.mutateAsync({ videoId });
  };

  return {
    uploadGalleryVideo,
    deleteGalleryVideo,
    isUploadingGalleryVideo: uploadGalleryVideoMutation.isPending,
    isDeletingGalleryVideo: deleteGalleryVideoMutation.isPending,
  };
}
