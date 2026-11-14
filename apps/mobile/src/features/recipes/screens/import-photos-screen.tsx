import type { ImagePickerAsset } from "expo-image-picker";
import type { ComponentProps } from "react";
import React, { useState } from "react";
import { Alert, Image, Pressable, Text, useWindowDimensions, View } from "react-native";
import { GlassCloseButton } from "@/components/glass-close-button";
import { Sheet, SHEET_INSET, SheetBody } from "@/components/sheet";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { File } from "expo-file-system";
import { UIImagePickerPreferredAssetRepresentationMode } from "expo-image-picker";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useUploadLimitsQuery } from "@norish/shared-react/config";
import { useImportRecipe } from "@norish/shared-react/recipes";
import { MAX_OCR_FILES } from "@norish/shared/contracts/uploads";
import { fitOcrCap, refuseOcrImage } from "@norish/shared/lib/ocr-images";

import type { PhotoSource } from "../utils/photo-source";
import { usePhotoPicker } from "../hooks/use-photo-picker";
import { useStartImport } from "../hooks/use-start-import";

/** Three tiles a row with 8 pt gaps, inside the sheet's sides. */
const COLUMNS = 3;
const GAP = 8;

/** iOS hands HEIC over as JPEG, which the import takes; the camera's photo is one file. */
const pickerOptions = (source: PhotoSource, room: number) =>
  source === "camera"
    ? { mediaTypes: ["images" as const], quality: 0.9 }
    : {
        mediaTypes: ["images" as const],
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: room,
        quality: 0.9,
        preferredAssetRepresentationMode: UIImagePickerPreferredAssetRepresentationMode.Compatible,
      };

const SOURCE_TILE: Record<
  PhotoSource,
  { icon: ComponentProps<typeof Ionicons>["name"]; labelId: string }
> = {
  camera: { icon: "camera-outline", labelId: "recipes.addRecipe.camera" },
  library: { icon: "image-outline", labelId: "recipes.addRecipe.photoLibrary" },
};

/** Import from photos (AI only): up to ten pages from the camera or the library, one recipe. */
export function ImportPhotosScreen() {
  const intl = useIntl();
  const [photos, setPhotos] = useState<File[]>([]);
  const { limits } = useUploadLimitsQuery();
  const { importFromImages } = useImportRecipe({ stay: true });
  const startImport = useStartImport();
  const accentText = useAccentTextColor();
  const [muted, accentForeground] = useThemeColor(["muted", "accent-foreground"] as const);
  const tile = (useWindowDimensions().width - 2 * SHEET_INSET - GAP * (COLUMNS - 1)) / COLUMNS;
  const isFull = photos.length >= MAX_OCR_FILES;
  const limitsText = intl.formatMessage(
    { id: "recipes.addRecipe.photoLimits" },
    { max: MAX_OCR_FILES }
  );

  // Each file is checked as it will be sent; one alert names every refused file, as web's toasts do.
  const add = (assets: ImagePickerAsset[]) => {
    const refusals: { titleId: string; message: string }[] = [];
    const accepted = assets.flatMap((asset) => {
      const file = new File(asset.uri);
      const refusal = refuseOcrImage(file, limits.maxImageSize);

      if (refusal) {
        refusals.push({
          titleId:
            refusal === "type" ? "common.import.image.invalidType" : "common.import.image.tooLarge",
          message: intl.formatMessage(
            {
              id:
                refusal === "type"
                  ? "common.import.image.notSupported"
                  : "common.import.image.exceeds",
            },
            { name: file.name }
          ),
        });
      }

      return refusal ? [] : [file];
    });
    const { kept, dropped } = fitOcrCap(photos.length, accepted);

    setPhotos([...photos, ...kept]);
    if (dropped.length > 0) {
      refusals.push({
        titleId: "common.import.image.tooMany",
        message: intl.formatMessage({ id: "common.import.image.maxFiles" }, { max: MAX_OCR_FILES }),
      });
    }

    const [first] = refusals;

    if (first) {
      Alert.alert(
        intl.formatMessage({ id: first.titleId }),
        refusals.map(({ message }) => message).join("\n")
      );
    }
  };
  const { sources, pick } = usePhotoPicker(add);

  return (
    <Sheet
      actions={
        <Button
          accessibilityLabel={intl.formatMessage({ id: "common.actions.importWithAI" })}
          className="h-[50px]"
          isDisabled={photos.length === 0}
          testID="import-photos-submit"
          variant="primary"
          onPress={startImport(() => importFromImages(photos))}
        >
          <Ionicons color={accentForeground} name="sparkles-outline" size={18} />
          <Button.Label className="font-semibold">
            {intl.formatMessage({ id: "common.actions.importWithAI" })}
          </Button.Label>
        </Button>
      }
      name="import-photos"
      title={intl.formatMessage({ id: "recipes.addRecipe.photosTitle" })}
    >
      <SheetBody contentClassName="gap-3">
        <View className="flex-row flex-wrap gap-2">
          {photos.map((photo, index) => (
            <View
              key={photo.uri}
              className="overflow-hidden rounded-[20px]"
              style={{ width: tile, height: tile }}
              testID={`import-photos-photo-${index}`}
            >
              <Image
                accessibilityIgnoresInvertColors
                className="bg-default size-full"
                resizeMode="cover"
                source={{ uri: photo.uri }}
              />
              <View className="absolute top-1.5 right-1.5">
                <GlassCloseButton
                  label={intl.formatMessage(
                    { id: "recipes.addRecipe.removePhoto" },
                    { number: index + 1 }
                  )}
                  size="small"
                  testID={`import-photos-remove-${index}`}
                  onPress={() => setPhotos(photos.filter((other) => other !== photo))}
                />
              </View>
            </View>
          ))}
          {sources.map((source) => (
            <Pressable
              key={source}
              accessibilityLabel={intl.formatMessage({ id: SOURCE_TILE[source].labelId })}
              accessibilityRole="button"
              accessibilityState={{ disabled: isFull }}
              className={`bg-default items-center justify-center gap-1.5 rounded-[20px] ${isFull ? "opacity-40" : ""}`}
              disabled={isFull}
              style={{ width: tile, height: tile }}
              testID={`import-photos-${source}`}
              onPress={() =>
                void pick(source, pickerOptions(source, MAX_OCR_FILES - photos.length))
              }
            >
              <Ionicons color={accentText} name={SOURCE_TILE[source].icon} size={24} />
              <Text className="text-foreground text-sm font-medium">
                {intl.formatMessage({ id: SOURCE_TILE[source].labelId })}
              </Text>
            </Pressable>
          ))}
        </View>
        <View className="flex-row items-center justify-center gap-0.5">
          <Text className="text-muted text-sm" testID="import-photos-count">
            {photos.length > 0
              ? intl.formatMessage({ id: "recipes.addRecipe.photoCount" }, { count: photos.length })
              : limitsText}
          </Text>
          {photos.length > 0 ? (
            <Pressable
              accessibilityLabel={limitsText}
              accessibilityRole="button"
              className="size-7 items-center justify-center rounded-full"
              hitSlop={8}
              testID="import-photos-info"
              onPress={() => Alert.alert(limitsText)}
            >
              <Ionicons color={muted} name="information-circle-outline" size={18} />
            </Pressable>
          ) : null}
        </View>
      </SheetBody>
    </Sheet>
  );
}
