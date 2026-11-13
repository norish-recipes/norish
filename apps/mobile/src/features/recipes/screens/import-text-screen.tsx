import type { ComponentRef } from "react";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Sheet, SheetBody } from "@/components/sheet";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Button, FieldError, Label, TextArea, TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { usePermissions } from "@norish/shared-react/reader";
import { isPasteTooLong, useImportRecipe } from "@norish/shared-react/recipes";
import { MAX_RECIPE_PASTE_CHARS } from "@norish/shared/contracts/uploads";

import { useStartOnce } from "../hooks/use-start-once";

/** Import from text: a field as tall as the sheet for a pasted recipe or JSON-LD. */
export function ImportTextScreen() {
  const intl = useIntl();
  const router = useRouter();
  const [text, setText] = useState("");
  const isAIEnabled = usePermissions((permissions) => permissions.isAIEnabled);
  const { importFromPaste, importFromPasteWithAI } = useImportRecipe({ stay: true });
  const startOnce = useStartOnce();
  const accentText = useAccentTextColor();
  const [muted, accentForeground] = useThemeColor(["muted", "accent-foreground"] as const);
  const fieldRef = useRef<ComponentRef<typeof TextArea>>(null);
  const trimmed = text.trim();
  // Only the AI import has a length cap, as on web; the field says so before a press can.
  const isTooLong = isAIEnabled && isPasteTooLong(text);
  const limit = intl.formatMessage(
    { id: "common.import.paste.maxCharacters" },
    { max: intl.formatNumber(MAX_RECIPE_PASTE_CHARS) }
  );

  useEffect(() => fieldRef.current?.focus(), []);

  const start = (run: (text: string) => boolean | void) =>
    startOnce(() => {
      if (run(trimmed) === false) return false;
      router.back();
    });

  return (
    <Sheet
      actions={
        <Sheet.Actions>
          {isAIEnabled ? (
            <Sheet.Action>
              <Button
                accessibilityLabel={intl.formatMessage({ id: "common.actions.aiImport" })}
                className="bg-surface h-[50px]"
                isDisabled={trimmed === "" || isTooLong}
                testID="import-text-ai"
                variant="secondary"
                onPress={start(importFromPasteWithAI)}
              >
                <Ionicons color={accentText} name="sparkles-outline" size={18} />
                <Button.Label className="text-foreground font-medium">
                  {intl.formatMessage({ id: "common.actions.aiImport" })}
                </Button.Label>
              </Button>
            </Sheet.Action>
          ) : null}
          <Sheet.Action>
            <Button
              accessibilityLabel={intl.formatMessage({ id: "common.actions.import" })}
              className="h-[50px]"
              isDisabled={trimmed === ""}
              testID="import-text-submit"
              variant="primary"
              onPress={start(importFromPaste)}
            >
              <Ionicons color={accentForeground} name="download-outline" size={18} />
              <Button.Label className="font-semibold">
                {intl.formatMessage({ id: "common.actions.import" })}
              </Button.Label>
            </Button>
          </Sheet.Action>
        </Sheet.Actions>
      }
      name="import-text"
      title={intl.formatMessage({ id: "recipes.addRecipe.textTitle" })}
    >
      <SheetBody contentClassName="flex-1">
        <TextField className="flex-1 gap-2" isInvalid={isTooLong}>
          <View className="flex-row items-center justify-between pr-0.5 pl-2">
            <Label>
              <Label.Text className="text-foreground text-[15px] font-medium">
                {intl.formatMessage({ id: "common.import.paste.label" })}
              </Label.Text>
            </Label>
            <Pressable
              accessibilityLabel={limit}
              accessibilityRole="button"
              className="size-7 items-center justify-center rounded-full"
              hitSlop={8}
              testID="import-text-info"
              onPress={() => Alert.alert(limit)}
            >
              <Ionicons color={muted} name="information-circle-outline" size={20} />
            </Pressable>
          </View>
          <TextArea
            ref={fieldRef}
            scrollEnabled
            className="bg-surface ios:shadow-none flex-1 rounded-3xl px-4 py-3.5 text-base leading-[23px]"
            placeholder={intl.formatMessage({ id: "common.import.paste.placeholder" })}
            testID="import-text-field"
            textAlignVertical="top"
            value={text}
            onChangeText={setText}
          />
          <FieldError className="px-2" testID="import-text-too-long">
            {limit}
          </FieldError>
        </TextField>
      </SheetBody>
    </Sheet>
  );
}
