import type { CreateRecipeHooksOptions } from "../types";

import { useMutation } from "@tanstack/react-query";


export function createUseRecipeVideos({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRecipeVideos() {
    const trpc = useTRPC();

    const uploadGalleryVideoMutation = useMutation(
      trpc.recipes.uploadGalleryVideo.mutationOptions()
    );
    const deleteGalleryVideoMutation = useMutation(
      trpc.recipes.deleteGalleryVideo.mutationOptions()
    );

    return {
      uploadGalleryVideoData: (
        input: Parameters<typeof uploadGalleryVideoMutation.mutateAsync>[0]
      ) => uploadGalleryVideoMutation.mutateAsync(input),
      deleteGalleryVideo: (videoId: string) => deleteGalleryVideoMutation.mutateAsync({ videoId }),
      isUploadingGalleryVideo: uploadGalleryVideoMutation.isPending,
      isDeletingGalleryVideo: deleteGalleryVideoMutation.isPending,
    };
  };
}
