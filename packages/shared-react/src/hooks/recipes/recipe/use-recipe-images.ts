import { useMutation } from "@tanstack/react-query";

import type { CreateRecipeHooksOptions } from "../types";

export function createUseRecipeImages({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRecipeImages() {
    const trpc = useTRPC();

    const uploadImageMutation = useMutation(trpc.recipes.uploadImage.mutationOptions());
    const deleteImageMutation = useMutation(trpc.recipes.deleteImage.mutationOptions());
    const uploadStepImageMutation = useMutation(trpc.recipes.uploadStepImage.mutationOptions());
    const deleteStepImageMutation = useMutation(trpc.recipes.deleteStepImage.mutationOptions());
    const uploadGalleryImageMutation = useMutation(
      trpc.recipes.uploadGalleryImage.mutationOptions()
    );
    const deleteGalleryImageMutation = useMutation(
      trpc.recipes.deleteGalleryImage.mutationOptions()
    );

    return {
      uploadImageData: (input: Parameters<typeof uploadImageMutation.mutateAsync>[0]) =>
        uploadImageMutation.mutateAsync(input),
      deleteImage: (url: string) => deleteImageMutation.mutateAsync({ url }),
      uploadStepImageData: (input: Parameters<typeof uploadStepImageMutation.mutateAsync>[0]) =>
        uploadStepImageMutation.mutateAsync(input),
      deleteStepImage: (url: string) => deleteStepImageMutation.mutateAsync({ url }),
      uploadGalleryImageData: (
        input: Parameters<typeof uploadGalleryImageMutation.mutateAsync>[0]
      ) => uploadGalleryImageMutation.mutateAsync(input),
      deleteGalleryImage: (imageId: string, version: number) =>
        deleteGalleryImageMutation.mutateAsync({ imageId, version }),
      isUploadingImage: uploadImageMutation.isPending,
      isDeletingImage: deleteImageMutation.isPending,
      isUploadingStepImage: uploadStepImageMutation.isPending,
      isDeletingStepImage: deleteStepImageMutation.isPending,
      isUploadingGalleryImage: uploadGalleryImageMutation.isPending,
      isDeletingGalleryImage: deleteGalleryImageMutation.isPending,
    };
  };
}
