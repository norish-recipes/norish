import { useMutation } from "@tanstack/react-query";

import type { CreateRecipeHooksOptions } from "../types";

export function createUseRecipeVideos({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRecipeVideos() {
    "use memo";

    const trpc = useTRPC();

    const uploadGalleryVideoMutation = useMutation(
      trpc.recipes.uploadGalleryVideo.mutationOptions()
    );
    const { mutateAsync: mutateUploadGalleryVideoAsync } = uploadGalleryVideoMutation;
    const deleteGalleryVideoMutation = useMutation(
      trpc.recipes.deleteGalleryVideo.mutationOptions()
    );
    const { mutateAsync: mutateDeleteGalleryVideoAsync } = deleteGalleryVideoMutation;

    return {
      uploadGalleryVideoData: (
        input: Parameters<typeof uploadGalleryVideoMutation.mutateAsync>[0]
      ) => mutateUploadGalleryVideoAsync(input),
      deleteGalleryVideo: (videoId: string, version: number) =>
        mutateDeleteGalleryVideoAsync({ videoId, version }),
      isUploadingGalleryVideo: uploadGalleryVideoMutation.isPending,
      isDeletingGalleryVideo: deleteGalleryVideoMutation.isPending,
    };
  };
}
