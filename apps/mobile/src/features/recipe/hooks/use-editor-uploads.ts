import type * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert } from "react-native";
import { File } from "expo-file-system";
import { useIntl } from "react-intl";

import type { RecipeGalleryMedia, StepImage } from "@norish/shared-react/recipes";
import { useConnectivity } from "@norish/shared-react/offline/react";
import { useRecipeImages, useRecipeVideos } from "@norish/shared-react/recipes";
import { createClientLogger } from "@norish/shared/lib/logger";
import { uploadForm } from "@norish/shared/lib/upload-form";

const log = createClientLogger("EditorUploads");

/**
 * The editor's photo uploads, which need the server: the form must hold each photo's address,
 * which a queued upload has not got yet. Removing a photo deletes it at once, as on web.
 */
export function useEditorUploads(recipeId: string) {
  const intl = useIntl();
  const { isOffline } = useConnectivity();
  const images = useRecipeImages();
  const { deleteGalleryVideo } = useRecipeVideos();
  const [uploading, setUploading] = useState(0);
  const text = (id: string) => intl.formatMessage({ id });

  const failed = (error: unknown) => {
    log.error({ error }, "Photo upload failed");
    Alert.alert(
      text("recipes.gallery.uploadFailed"),
      error instanceof Error ? error.message : undefined
    );
  };
  /** Runs `upload` once per photo, in order, while counting it as uploading. */
  const each = async <T>(
    assets: ImagePicker.ImagePickerAsset[],
    upload: (file: File, index: number) => Promise<T | null>
  ): Promise<T[]> => {
    const done: T[] = [];

    setUploading((count) => count + assets.length);
    for (const [index, asset] of assets.entries()) {
      const result = await upload(new File(asset.uri), index).catch((error: unknown) => {
        failed(error);

        return null;
      });

      setUploading((count) => count - 1);
      if (result) done.push(result);
    }

    return done;
  };

  return {
    isUploading: uploading > 0,
    /** False, after saying why, while the server can't take a photo. */
    canUpload: () => {
      if (isOffline) Alert.alert(text("recipes.editor.photosOffline"));

      return !isOffline;
    },
    uploadGallery: (assets: ImagePicker.ImagePickerAsset[], firstOrder: number) =>
      each(assets, async (file, index) => {
        const order = firstOrder + index;
        const result = await images.uploadGalleryImageData(
          uploadForm({ image: file, recipeId, order })
        );

        if (!result.success || !result.url) throw new Error(result.error);

        return {
          id: result.id,
          type: "image",
          src: result.url,
          order: result.order ?? order,
          version: result.version,
        } satisfies RecipeGalleryMedia;
      }),
    /** The photos in pick order; the row orders them as it is when they join. */
    uploadStep: (assets: ImagePicker.ImagePickerAsset[]) =>
      each(assets, async (file, index) => {
        const result = await images.uploadStepImageData(uploadForm({ image: file, recipeId }));

        if (!result.success || !result.url) throw new Error(result.error);

        return { image: result.url, order: index } satisfies StepImage;
      }),
    removeGallery: (item: RecipeGalleryMedia) => {
      if (!item.id) return;
      const remove =
        item.type === "video"
          ? deleteGalleryVideo(item.id, item.version ?? 1)
          : images.deleteGalleryImage(item.id, item.version ?? 1);

      remove.catch((error: unknown) => log.error({ error }, "Failed to delete media"));
    },
    removeStepImage: (url: string) =>
      images
        .deleteStepImage(url)
        .catch((error: unknown) => log.error({ error }, "Failed to delete step image")),
  };
}
