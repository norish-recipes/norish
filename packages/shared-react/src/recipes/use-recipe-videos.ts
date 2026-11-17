"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "../trpc";
import { createSettled } from "./create-settled";

export function useRecipeVideos() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const uploadGalleryVideoMutation = useMutation(trpc.recipes.uploadGalleryVideo.mutationOptions());
  const { mutateAsync: mutateUploadGalleryVideoAsync } = uploadGalleryVideoMutation;
  const deleteGalleryVideoMutation = useMutation(trpc.recipes.deleteGalleryVideo.mutationOptions());
  const { mutateAsync: mutateDeleteGalleryVideoAsync } = deleteGalleryVideoMutation;

  return {
    /** Waits for the recipe's own create to be answered, so the video is linked to it. */
    uploadGalleryVideoData: async (
      input: Parameters<typeof uploadGalleryVideoMutation.mutateAsync>[0],
      recipeId: string
    ) => {
      await createSettled(queryClient, trpc.recipes.create.mutationKey(), recipeId);

      return mutateUploadGalleryVideoAsync(input);
    },
    deleteGalleryVideo: (videoId: string, version: number) =>
      mutateDeleteGalleryVideoAsync({ videoId, version }),
    isUploadingGalleryVideo: uploadGalleryVideoMutation.isPending,
    isDeletingGalleryVideo: deleteGalleryVideoMutation.isPending,
  };
}
