import React from "react";
import { Image, View } from "react-native";
import { GlassCloseButton } from "@/components/glass";
import { useServerImage } from "@/lib/network/server-url";
import { useIntl } from "react-intl";

import type { StepImage } from "@norish/shared-react/recipes";

/** A step's photos as thumbnails, each with its remove button. */
export function StepPhotos({
  images,
  rowIndex,
  onRemove,
}: {
  images: StepImage[];
  rowIndex: number;
  onRemove: (imageIndex: number) => void;
}) {
  const intl = useIntl();
  const toImage = useServerImage();

  return (
    <View className="flex-row flex-wrap gap-2">
      {images.map((image, imageIndex) => (
        // The same picture can sit here twice, so only its place tells the two apart.
        // eslint-disable-next-line @eslint-react/no-array-index-key
        <View key={imageIndex} className="size-16">
          <Image
            className="size-16 rounded-xl"
            source={toImage(image.image)}
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
    </View>
  );
}
