import type * as ImagePicker from "expo-image-picker";
import React from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { GlassCloseButton, GlassSurface } from "@/components/glass";
import { usePhotoSourceSheet } from "@/hooks/use-photo-source-sheet";
import { useServerImage } from "@/lib/network/server-url";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecipeGalleryMedia } from "@norish/shared-react/recipes";
import { MAX_RECIPE_IMAGES } from "@norish/shared/contracts/zod/recipe-images";
import { MAX_RECIPE_VIDEOS } from "@norish/shared/contracts/zod/recipe-videos";

import type { useEditorUploads } from "../../hooks/use-editor-uploads";
import { ClassIcon } from "./editor-parts";

const TILE = 104;
const GALLERY_PHOTO = {
  mediaTypes: ["images"],
  allowsMultipleSelection: true,
  quality: 0.9,
} satisfies ImagePicker.ImagePickerOptions;

function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** The recipe's photos and videos in a row, the first one the cover, then Add. */
export function MediaStrip({
  media,
  uploads,
  onChange,
}: {
  media: RecipeGalleryMedia[];
  uploads: ReturnType<typeof useEditorUploads>;
  onChange: (media: RecipeGalleryMedia[]) => void;
}) {
  const intl = useIntl();
  const toImage = useServerImage();
  const [foreground, border, warningForeground] = useThemeColor([
    "foreground",
    "border",
    "warning-foreground",
  ] as const);
  const imageCount = media.filter((item) => item.type === "image").length;
  const videoCount = media.length - imageCount;
  const room = MAX_RECIPE_IMAGES - imageCount;
  const text = (id: string, values?: Record<string, number>) => intl.formatMessage({ id }, values);

  const pick = usePhotoSourceSheet(text("recipes.editor.addPhoto"), (assets) => {
    void uploads.uploadGallery(assets.slice(0, room), media.length).then((added) => {
      if (added.length > 0) onChange([...media, ...added]);
    });
  });
  const remove = (item: RecipeGalleryMedia) => {
    uploads.removeGallery(item);
    onChange(media.filter((entry) => entry !== item).map((entry, order) => ({ ...entry, order })));
  };

  return (
    <View className="gap-2">
      <ScrollView
        horizontal
        className="-mx-5"
        contentContainerClassName="gap-2.5 px-5"
        showsHorizontalScrollIndicator={false}
      >
        {media.map((item, index) => (
          <View
            key={item.id ?? item.src}
            className="overflow-hidden rounded-[20px]"
            style={{ width: TILE, height: TILE }}
            testID={`editor-media-${index}`}
          >
            <Image
              source={toImage(item.type === "video" ? (item.thumbnail ?? item.src) : item.src)}
              style={{ width: TILE, height: TILE }}
            />
            {index === 0 ? (
              <View className="bg-warning absolute top-1.5 left-1.5 size-6 items-center justify-center rounded-full">
                <Ionicons color={warningForeground} name="star" size={13} />
              </View>
            ) : null}
            {item.type === "video" ? (
              <>
                <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
                  <View className="size-[34px] items-center justify-center rounded-full">
                    <GlassSurface radius={17} />
                    <Ionicons color={foreground} name="play" size={16} />
                  </View>
                </View>
                {item.duration ? (
                  <View className="absolute bottom-1.5 left-1.5 h-5 justify-center rounded-[10px] px-[7px]">
                    <GlassSurface radius={10} />
                    <Text className="text-foreground text-[11px] font-semibold">
                      {formatDuration(item.duration)}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : null}
            <View className="absolute top-1.5 right-1.5">
              <GlassCloseButton
                label={text("recipes.editor.removePhoto")}
                size="small"
                testID={`editor-media-remove-${index}`}
                onPress={() => remove(item)}
              />
            </View>
          </View>
        ))}
        {room > 0 ? (
          <Pressable
            accessibilityLabel={text("recipes.editor.addPhoto")}
            accessibilityRole="button"
            className="items-center justify-center gap-1.5 rounded-[20px]"
            style={{ width: TILE, height: TILE, borderWidth: 1.5, borderColor: border }}
            testID="editor-media-add"
            onPress={() => {
              if (uploads.canUpload()) pick(GALLERY_PHOTO);
            }}
          >
            {uploads.isUploading ? (
              <ActivityIndicator />
            ) : (
              <ClassIcon colorClassName="text-accent-text" name="add" size={24} />
            )}
            <Text className="text-accent-text text-sm font-medium">
              {text("common.actions.add")}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      {media.length > 0 ? (
        <Text className="text-muted mx-1 text-right text-[13px]">
          {text("recipes.editor.mediaCount", {
            images: imageCount,
            maxImages: MAX_RECIPE_IMAGES,
            videos: videoCount,
            maxVideos: MAX_RECIPE_VIDEOS,
          })}
        </Text>
      ) : null}
    </View>
  );
}
