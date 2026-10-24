import { useMutation } from "@tanstack/react-query";

import type { CreateRecipeHooksOptions } from "../types";

export function createUseRecipeImages({ useTRPC }: CreateRecipeHooksOptions) {
  return function useRecipeImages() {
    "use memo";

    const trpc = useTRPC();

    const uploadImageMutation = useMutation(trpc.recipes.uploadImage.mutationOptions());
    const { mutateAsync: mutateUploadImageAsync } = uploadImageMutation;
    const deleteImageMutation = useMutation(trpc.recipes.deleteImage.mutationOptions());
    const { mutateAsync: mutateDeleteImageAsync } = deleteImageMutation;
    const uploadStepImageMutation = useMutation(trpc.recipes.uploadStepImage.mutationOptions());
    const { mutateAsync: mutateUploadStepImageAsync } = uploadStepImageMutation;
    const deleteStepImageMutation = useMutation(trpc.recipes.deleteStepImage.mutationOptions());
    const { mutateAsync: mutateDeleteStepImageAsync } = deleteStepImageMutation;
    const uploadGalleryImageMutation = useMutation(
      trpc.recipes.uploadGalleryImage.mutationOptions()
    );
    const { mutateAsync: mutateUploadGalleryImageAsync } = uploadGalleryImageMutation;
    const deleteGalleryImageMutation = useMutation(
      trpc.recipes.deleteGalleryImage.mutationOptions()
    );
    const { mutateAsync: mutateDeleteGalleryImageAsync } = deleteGalleryImageMutation;

    return {
      uploadImageData: (input: Parameters<typeof uploadImageMutation.mutateAsync>[0]) =>
        mutateUploadImageAsync(input),
      deleteImage: (url: string) => mutateDeleteImageAsync({ url }),
      uploadStepImageData: (input: Parameters<typeof uploadStepImageMutation.mutateAsync>[0]) =>
        mutateUploadStepImageAsync(input),
      deleteStepImage: (url: string) => mutateDeleteStepImageAsync({ url }),
      uploadGalleryImageData: (
        input: Parameters<typeof uploadGalleryImageMutation.mutateAsync>[0]
      ) => mutateUploadGalleryImageAsync(input),
      deleteGalleryImage: (imageId: string, version: number) =>
        mutateDeleteGalleryImageAsync({ imageId, version }),
      isUploadingImage: uploadImageMutation.isPending,
      isDeletingImage: deleteImageMutation.isPending,
      isUploadingStepImage: uploadStepImageMutation.isPending,
      isDeletingStepImage: deleteStepImageMutation.isPending,
      isUploadingGalleryImage: uploadGalleryImageMutation.isPending,
      isDeletingGalleryImage: deleteGalleryImageMutation.isPending,
    };
  };
}
