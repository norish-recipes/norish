import type { PhotoSource } from "@/lib/photo-source";
import type { ImagePickerAsset } from "expo-image-picker";
import type { ComponentProps } from "react";
import React, { useState } from "react";
import { Alert, Image, ScrollView, Text, View } from "react-native";
import { Card, CardRow } from "@/components/card";
import { HintButton } from "@/components/hint-button";
import { IconButton } from "@/components/icon-button";
import { Sheet, SheetBody } from "@/components/sheet";
import { usePhotoPicker } from "@/hooks/use-photo-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { File } from "expo-file-system";
import { useIntl } from "react-intl";

import { useUploadLimitsQuery } from "@norish/shared-react/config";
import { useImportRecipe } from "@norish/shared-react/recipes";
import { MAX_OCR_FILES } from "@norish/shared/contracts/uploads";
import { fitOcrCap, refuseOcrImage } from "@norish/shared/lib/ocr-images";

import { useStartImport } from "../hooks/use-start-import";

/** The library hands several photos over in pick order; the camera's photo is one file. */
const pickerOptions = (source: PhotoSource, room: number) =>
  source === "camera"
    ? { mediaTypes: ["images" as const], quality: 0.9 }
    : {
        mediaTypes: ["images" as const],
        allowsMultipleSelection: true,
        orderedSelection: true,
        selectionLimit: room,
        quality: 0.9,
      };

const SOURCE_ROW: Record<
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
  const { sources, pick } = usePhotoPicker();

  return (
    <Sheet
      confirm={{
        label: intl.formatMessage({ id: "common.actions.importWithAI" }),
        symbol: "checkmark",
        disabled: photos.length === 0,
        onPress: startImport(() => importFromImages(photos)),
      }}
      name="import-photos"
      title={intl.formatMessage({ id: "recipes.addRecipe.photosTitle" })}
    >
      <SheetBody contentClassName="gap-3">
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {photos.map((photo, index) => (
                <View
                  key={photo.uri}
                  className="size-24 overflow-hidden rounded-[18px]"
                  testID={`import-photos-photo-${index}`}
                >
                  <Image
                    accessibilityIgnoresInvertColors
                    className="bg-sand size-full"
                    resizeMode="cover"
                    source={{ uri: photo.uri }}
                  />
                  <View className="absolute top-1.5 right-1.5">
                    <IconButton
                      small
                      icon="close"
                      label={intl.formatMessage(
                        { id: "recipes.addRecipe.removePhoto" },
                        { number: index + 1 }
                      )}
                      testID={`import-photos-remove-${index}`}
                      onPress={() => setPhotos(photos.filter((other) => other !== photo))}
                    />
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : null}
        <Card>
          {sources.map((source, index) => (
            <CardRow
              key={source}
              disabled={isFull}
              first={index === 0}
              icon={SOURCE_ROW[source].icon}
              label={intl.formatMessage({ id: SOURCE_ROW[source].labelId })}
              testID={`import-photos-${source}`}
              onPress={() =>
                void pick(source, pickerOptions(source, MAX_OCR_FILES - photos.length), add)
              }
            />
          ))}
        </Card>
        <View className="flex-row items-center gap-0.5 px-2">
          <Text className="text-muted text-sm" testID="import-photos-count">
            {photos.length > 0
              ? intl.formatMessage({ id: "recipes.addRecipe.photoCount" }, { count: photos.length })
              : limitsText}
          </Text>
          {photos.length > 0 ? (
            <HintButton
              className="size-7 items-center justify-center rounded-full"
              hint={limitsText}
              testID="import-photos-info"
            />
          ) : null}
        </View>
      </SheetBody>
    </Sheet>
  );
}
