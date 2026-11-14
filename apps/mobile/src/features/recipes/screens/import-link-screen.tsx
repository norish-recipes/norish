import type { ComponentRef } from "react";
import React, { useState } from "react";
import { Pressable } from "react-native";
import { Sheet, SheetBody } from "@/components/sheet";
import { useFocusOnMount } from "@/hooks/use-focus-on-mount";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { FieldError, InputGroup, Label, TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useImportRecipe } from "@norish/shared-react/recipes";

import { ImportActions } from "../components/import-actions";
import { useStartImport } from "../hooks/use-start-import";
import { isImportableLink } from "../utils/copied-link";

/** Import from a link: opened with the copied link when Add recipe had one, else empty and focused. */
export function ImportLinkScreen() {
  const intl = useIntl();
  const { url: copiedUrl } = useLocalSearchParams<{ url?: string }>();
  const [link, setLink] = useState(copiedUrl ?? "");
  const [isInvalid, setIsInvalid] = useState(false);
  const { importRecipe, importRecipeWithAI } = useImportRecipe({ stay: true });
  const startImport = useStartImport();
  const [muted, foreground] = useThemeColor(["muted", "foreground"] as const);
  // An empty sheet is there to be typed into; a copied link is imported with one tap.
  const fieldRef = useFocusOnMount<ComponentRef<typeof InputGroup.Input>>(!copiedUrl);
  const trimmed = link.trim();

  // A new text clears the error the old one raised.
  const changeLink = (value: string) => {
    setLink(value);
    setIsInvalid(false);
  };

  // A link that can't be opened is said under the field and starts nothing.
  const start = (run: (url: string) => void) =>
    startImport(() => {
      if (!isImportableLink(trimmed)) {
        setIsInvalid(true);

        return false;
      }
      run(trimmed);
    });

  return (
    <Sheet
      actions={
        <ImportActions
          isDisabled={trimmed === ""}
          name="import-link"
          onAIImport={start(importRecipeWithAI)}
          onImport={start(importRecipe)}
        />
      }
      name="import-link"
      title={intl.formatMessage({ id: "recipes.addRecipe.linkTitle" })}
    >
      <SheetBody>
        <TextField className="gap-2" isInvalid={isInvalid}>
          <Label className="px-2">
            <Label.Text className="text-foreground text-[15px] font-medium">
              {intl.formatMessage({ id: "common.import.url.label" })}
            </Label.Text>
          </Label>
          <InputGroup>
            <InputGroup.Prefix isDecorative className="pr-2.5 pl-4">
              <Ionicons color={muted} name="link" size={18} />
            </InputGroup.Prefix>
            <InputGroup.Input
              ref={fieldRef}
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-default ios:shadow-none h-[52px] rounded-full text-base"
              keyboardType="url"
              placeholder={intl.formatMessage({ id: "common.import.url.placeholder" })}
              returnKeyType="go"
              testID="import-link-field"
              textContentType="URL"
              value={link}
              onChangeText={changeLink}
              onSubmitEditing={trimmed ? start(importRecipe) : undefined}
            />
            {link ? (
              <InputGroup.Suffix className="pr-3 pl-2">
                <Pressable
                  accessibilityLabel={intl.formatMessage({ id: "common.actions.clear" })}
                  accessibilityRole="button"
                  className="bg-surface size-7 items-center justify-center rounded-full"
                  hitSlop={8}
                  testID="import-link-clear"
                  onPress={() => {
                    changeLink("");
                    fieldRef.current?.focus();
                  }}
                >
                  <Ionicons color={foreground} name="close" size={14} />
                </Pressable>
              </InputGroup.Suffix>
            ) : null}
          </InputGroup>
          <FieldError className="px-2" testID="import-link-invalid">
            {intl.formatMessage({ id: "common.validation.invalidUrl" })}
          </FieldError>
        </TextField>
      </SheetBody>
    </Sheet>
  );
}
