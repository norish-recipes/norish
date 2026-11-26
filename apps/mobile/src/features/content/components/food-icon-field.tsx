import type * as ImagePicker from "expo-image-picker";
import React from "react";
import { View } from "react-native";
import { Card } from "@/components/card";
import { PillButton } from "@/components/pill-button";
import { ServerImage } from "@/components/server-image";
import { usePhotoSourceSheet } from "@/hooks/use-photo-source-sheet";
import { useText } from "@/lib/i18n/use-text";
import { File } from "expo-file-system";

import type { IconDraft, IngredientItem } from "@norish/shared-react/ingredients";
import { useIngredientIconMutations } from "@norish/shared-react/ingredients";
import { useHiddenItemVisibility, usePermissions } from "@norish/shared-react/reader";

const PICKER: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.9,
};

/** The food's icon beside its name field: Upload a picture, Generate one where the instance can
 * draw, or Remove the food's own; each is part of the draft. Nothing for a reader who hid icons. */
export function FoodIconField({
  item,
  icons,
  onDraftChange,
}: {
  item: IngredientItem;
  icons: { shown: string | null; hasOwn: boolean; remove: () => void };
  onDraftChange: (draft: IconDraft) => void;
}) {
  const text = useText();
  const mutations = useIngredientIconMutations(item.id);
  const canDrawImages = usePermissions((permissions) => permissions.canDrawImages);
  const { showIngredientIcons } = useHiddenItemVisibility();
  const pick = usePhotoSourceSheet(text("settings.ingredients.icon.change"));

  if (!showIngredientIcons) return null;

  const picture = (
    <Card>
      <View className="size-[76px] items-center justify-center" testID="food-icon">
        {icons.shown ? (
          <ServerImage
            accessibilityElementsHidden
            contentFit="contain"
            path={icons.shown}
            style={{ width: 56, height: 56 }}
          />
        ) : null}
      </View>
    </Card>
  );

  if (!item.canEdit) return picture;

  const upload = () =>
    pick(PICKER, async ([asset]) => {
      const stored = await mutations.upload(new File(asset!.uri));

      if (stored) onDraftChange(stored);
    });
  const generate = async () => {
    const drawn = await mutations.generate();

    if (drawn) onDraftChange(drawn);
  };

  return (
    <View className="gap-2" testID="food-icon-field">
      {picture}
      {mutations.isPending ? null : (
        <View className="flex-row flex-wrap gap-2">
          <PillButton
            icon="cloud-upload-outline"
            label={text("settings.ingredients.icon.upload")}
            testID="food-icon-upload"
            onPress={upload}
          />
          {canDrawImages ? (
            <PillButton
              icon="sparkles-outline"
              label={text("settings.ingredients.icon.generate")}
              testID="food-icon-generate"
              onPress={() => void generate()}
            />
          ) : null}
          {icons.hasOwn ? (
            <PillButton
              label={text("settings.ingredients.icon.remove")}
              testID="food-icon-remove"
              tone="danger"
              onPress={icons.remove}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}
