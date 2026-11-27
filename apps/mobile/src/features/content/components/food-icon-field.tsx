import type * as ImagePicker from "expo-image-picker";
import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { Card } from "@/components/card";
import { ChipRow } from "@/components/chip-row";
import { PillButton } from "@/components/pill-button";
import { ServerImage } from "@/components/server-image";
import { SideBySide, Stack } from "@/components/stack";
import { usePhotoSourceSheet } from "@/hooks/use-photo-source-sheet";
import { useText } from "@/lib/i18n/use-text";
import { File } from "expo-file-system";

import type { IconDraft, IngredientItem } from "@norish/shared-react/ingredients";
import { useIngredientIconMutations } from "@norish/shared-react/ingredients";
import { useConnectivity } from "@norish/shared-react/offline/react";
import { useHiddenItemVisibility, usePermissions } from "@norish/shared-react/reader";

const PICKER: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.9,
};

/** The icon's tile and the picture in it, in points. */
const TILE = 76;
const PICTURE = 56;

/** The food's icon beside its name field (`children`), with Upload, Generate and Remove under it,
 * all staged in the draft. A reader who hid icons gets the name alone. */
export function FoodIconField({
  item,
  icons,
  onDraftChange,
  children,
}: {
  item: IngredientItem;
  icons: { shown: string | null; hasOwn: boolean; remove: () => void };
  onDraftChange: (draft: IconDraft) => void;
  children: ReactNode;
}) {
  const text = useText();
  const mutations = useIngredientIconMutations(item.id);
  const canDrawImages = usePermissions((permissions) => permissions.canDrawImages);
  const { showIngredientIcons } = useHiddenItemVisibility();
  const { isOffline } = useConnectivity();
  const pick = usePhotoSourceSheet(text("settings.ingredients.icon.change"));

  if (!showIngredientIcons) return children;

  const picture = (
    <Card>
      <View
        className="items-center justify-center"
        style={{ width: TILE, height: TILE }}
        testID="food-icon"
      >
        {icons.shown ? (
          <ServerImage
            accessibilityElementsHidden
            contentFit="contain"
            path={icons.shown}
            style={{ width: PICTURE, height: PICTURE }}
          />
        ) : null}
      </View>
    </Card>
  );

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
    <SideBySide testID="food-icon-field">
      {picture}
      <Stack fill>
        {children}
        {item.canEdit && !mutations.isPending ? (
          <ChipRow>
            <PillButton
              disabled={isOffline}
              icon="cloud-upload-outline"
              label={text("settings.ingredients.icon.upload")}
              testID="food-icon-upload"
              onPress={upload}
            />
            {canDrawImages ? (
              <PillButton
                disabled={isOffline}
                icon="sparkles-outline"
                label={text("settings.ingredients.icon.generate")}
                testID="food-icon-generate"
                onPress={() => void generate()}
              />
            ) : null}
            {icons.hasOwn ? (
              <PillButton
                disabled={isOffline}
                label={text("settings.ingredients.icon.remove")}
                testID="food-icon-remove"
                tone="danger"
                onPress={icons.remove}
              />
            ) : null}
          </ChipRow>
        ) : null}
      </Stack>
    </SideBySide>
  );
}
