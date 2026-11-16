import React from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { GlassCloseButton } from "@/components/glass";
import { ServerImage } from "@/components/server-image";
import { useIntl } from "react-intl";

import type { StepImage } from "@norish/shared-react/recipes";

import type { PendingPhoto } from "../../hooks/use-editor-uploads";

/** A step's photos as thumbnails, then those still uploading; each with its remove button. */
export function StepPhotos({
  images,
  pending,
  rowIndex,
  onRemove,
  onCancel,
}: {
  images: StepImage[];
  pending: PendingPhoto[];
  rowIndex: number;
  onRemove: (imageIndex: number) => void;
  onCancel: (key: string) => void;
}) {
  const intl = useIntl();

  return (
    <View className="flex-row flex-wrap gap-2">
      {images.map((image, imageIndex) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- the same picture can sit here twice
        <View key={imageIndex} className="size-16">
          <ServerImage
            className="size-16 rounded-xl"
            path={image.image}
            style={{ width: 64, height: 64, borderRadius: 12 }}
          />
          <View className="absolute -top-1.5 -right-1.5">
            <GlassCloseButton
              label={intl.formatMessage({ id: "recipes.editor.removePhoto" })}
              size="small"
              testID={`editor-step-photo-remove-${rowIndex}-${imageIndex}`}
              onPress={() => onRemove(imageIndex)}
            />
          </View>
        </View>
      ))}
      {pending.map((photo, pendingIndex) => (
        <View key={photo.key} className="size-16">
          <Image
            className="size-16 rounded-xl opacity-50"
            source={{ uri: photo.uri }}
            style={{ width: 64, height: 64, borderRadius: 12 }}
          />
          <ActivityIndicator className="absolute inset-0" />
          <View className="absolute -top-1.5 -right-1.5">
            <GlassCloseButton
              label={intl.formatMessage({ id: "recipes.editor.removePhoto" })}
              size="small"
              testID={`editor-step-photo-pending-remove-${rowIndex}-${pendingIndex}`}
              onPress={() => onCancel(photo.key)}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
