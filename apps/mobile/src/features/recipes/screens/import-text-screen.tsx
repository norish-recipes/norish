import type { ComponentRef } from "react";
import React, { useState } from "react";
import { View } from "react-native";
import { HintButton } from "@/components/hint-button";
import { Sheet, SheetBody } from "@/components/sheet";
import { useFocusOnMount } from "@/hooks/use-focus-on-mount";
import { FieldError, Label, TextArea, TextField } from "heroui-native";
import { useIntl } from "react-intl";

import { usePermissions } from "@norish/shared-react/reader";
import { isPasteTooLong, useImportRecipe } from "@norish/shared-react/recipes";
import { MAX_RECIPE_PASTE_CHARS } from "@norish/shared/contracts/uploads";

import { ImportActions } from "../components/import-actions";
import { useStartImport } from "../hooks/use-start-import";

/** Import from text: a field for a pasted recipe or JSON-LD, in a sheet that fits it. */
export function ImportTextScreen() {
  const intl = useIntl();
  const [text, setText] = useState("");
  const isAIEnabled = usePermissions((permissions) => permissions.isAIEnabled);
  const { importFromPaste, importFromPasteWithAI } = useImportRecipe({ stay: true });
  const startImport = useStartImport();
  const fieldRef = useFocusOnMount<ComponentRef<typeof TextArea>>();
  const trimmed = text.trim();
  // Only the AI import has a length cap, as on web; the field says so before a press can.
  const isTooLong = isAIEnabled && isPasteTooLong(text);
  const limit = intl.formatMessage(
    { id: "common.import.paste.maxCharacters" },
    { max: intl.formatNumber(MAX_RECIPE_PASTE_CHARS) }
  );

  const start = (run: (text: string) => boolean | void) => startImport(() => run(trimmed));

  return (
    <Sheet
      actions={
        <ImportActions
          isAIDisabled={trimmed === "" || isTooLong}
          isDisabled={trimmed === ""}
          name="import-text"
          onAIImport={start(importFromPasteWithAI)}
          onImport={start(importFromPaste)}
        />
      }
      name="import-text"
      title={intl.formatMessage({ id: "recipes.addRecipe.textTitle" })}
    >
      <SheetBody>
        <TextField className="gap-2" isInvalid={isTooLong}>
          <View className="flex-row items-center justify-between pr-0.5 pl-2">
            <Label>
              <Label.Text className="text-foreground text-[15px] font-medium">
                {intl.formatMessage({ id: "common.import.paste.label" })}
              </Label.Text>
            </Label>
            <HintButton
              className="size-7 items-center justify-center rounded-full"
              hint={limit}
              size={20}
              testID="import-text-info"
            />
          </View>
          <TextArea
            ref={fieldRef}
            scrollEnabled
            className="bg-default ios:shadow-none h-[200px] rounded-3xl px-4 py-3.5 text-base leading-[23px]"
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
