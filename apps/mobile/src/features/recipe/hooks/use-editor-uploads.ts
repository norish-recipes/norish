import type * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import { Alert } from "react-native";
import { File } from "expo-file-system";
import { useIntl } from "react-intl";

import type { RecipeGalleryMedia, StepImage } from "@norish/shared-react/recipes";
import { useConnectivity } from "@norish/shared-react/offline/react";
import { useRecipeImages, useRecipeVideos } from "@norish/shared-react/recipes";
import { createClientLogger } from "@norish/shared/lib/logger";
import { createClientId } from "@norish/shared/lib/operation-helpers";
import { uploadForm } from "@norish/shared/lib/upload-form";

const log = createClientLogger("EditorUploads");

/** A photo still uploading: shown with a spinner, and removable while its upload hangs. */
export type PendingPhoto = { key: string; uri: string; target: string };

/** The editor's photo uploads, which need the server: the form holds each photo's address, which
 * a queued upload has not got. Removing a photo deletes it at once, as on web. */
export function useEditorUploads(recipeId: string) {
  const intl = useIntl();
  const { isOffline } = useConnectivity();
  const images = useRecipeImages();
  const { deleteGalleryVideo } = useRecipeVideos();
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  // Removed by the reader; one still uploading stops being waited for, and is deleted if it lands.
  const cancelledRef = useRef(new Set<string>());
  const removersRef = useRef(new Map<string, () => void>());
  const text = (id: string) => intl.formatMessage({ id });

  const failed = (error: unknown) => {
    log.error({ error }, "Photo upload failed");
    Alert.alert(
      text("recipes.gallery.uploadFailed"),
      error instanceof Error ? error.message : undefined
    );
  };
  /** Runs `upload` once per photo, in order, each pending until it lands, fails or is removed. */
  const each = async <T>(
    assets: ImagePicker.ImagePickerAsset[],
    target: string,
    upload: (file: File, index: number) => Promise<T>,
    discard: (result: T) => void
  ): Promise<T[]> => {
    const done: T[] = [];
    const queued = assets.map((asset) => ({ key: createClientId(), uri: asset.uri, target }));

    setPending((current) => [...current, ...queued]);
    for (const [index, photo] of queued.entries()) {
      const { key, uri } = photo;

      if (cancelledRef.current.has(key)) continue;
      // Any throw, reading the file included, ends this photo's wait.
      const uploading = Promise.resolve()
        .then(() => upload(new File(uri), index))
        .catch((error: unknown) => {
          if (!cancelledRef.current.has(key)) failed(error);

          return null;
        });
      const removed = new Promise<"removed">((resolve) =>
        removersRef.current.set(key, () => resolve("removed"))
      );
      const result = await Promise.race([uploading, removed]);

      removersRef.current.delete(key);
      setPending((current) => current.filter((photo) => photo.key !== key));
      if (result === "removed") {
        void uploading.then((late) => late !== null && discard(late));
      } else if (result !== null) {
        done.push(result);
      }
    }

    return done;
  };

  const removeGallery = (item: RecipeGalleryMedia) => {
    if (!item.id) return;
    const remove =
      item.type === "video"
        ? deleteGalleryVideo(item.id, item.version ?? 1)
        : images.deleteGalleryImage(item.id, item.version ?? 1);

    remove.catch((error: unknown) => log.error({ error }, "Failed to delete media"));
  };
  const removeStepImage = (url: string) =>
    images
      .deleteStepImage(url)
      .catch((error: unknown) => log.error({ error }, "Failed to delete step image"));

  return {
    isUploading: pending.length > 0,
    /** The photos still uploading to the gallery (`"gallery"`) or to a step row (its id). */
    pendingFor: (target: string) => pending.filter((photo) => photo.target === target),
    /** Remove a pending photo: Save no longer waits for it. */
    cancel: (key: string) => {
      cancelledRef.current.add(key);
      removersRef.current.get(key)?.();
      setPending((current) => current.filter((photo) => photo.key !== key));
    },
    /** False, after saying why, while the server can't take a photo. */
    canUpload: () => {
      if (isOffline) Alert.alert(text("recipes.editor.photosOffline"));

      return !isOffline;
    },
    uploadGallery: (assets: ImagePicker.ImagePickerAsset[], firstOrder: number) =>
      each(
        assets,
        "gallery",
        async (file, index) => {
          const order = firstOrder + index;
          const result = await images.uploadGalleryImageData(
            uploadForm({ image: file, recipeId, order }),
            recipeId
          );

          if (!result.success || !result.url) throw new Error(result.error);

          return {
            id: result.id,
            type: "image",
            src: result.url,
            order: result.order ?? order,
            version: result.version,
          } satisfies RecipeGalleryMedia;
        },
        removeGallery
      ),
    /** The photos in pick order; the row orders them as it is when they join. */
    uploadStep: (assets: ImagePicker.ImagePickerAsset[], rowId: string) =>
      each(
        assets,
        rowId,
        async (file, index) => {
          const result = await images.uploadStepImageData(uploadForm({ image: file, recipeId }));

          if (!result.success || !result.url) throw new Error(result.error);

          return { image: result.url, order: index } satisfies StepImage;
        },
        (image) => void removeStepImage(image.image)
      ),
    removeGallery,
    removeStepImage,
  };
}
