import type { ComponentRef } from "react";
import React, { useState } from "react";
import { Ionicons } from "@/components/icon";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { useFocusOnMount } from "@/hooks/use-focus-on-mount";
import { useLocalSearchParams } from "expo-router";
import { FieldError, TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useImportRecipe } from "@norish/shared-react/recipes";

import { useImportActions } from "../hooks/use-import-actions";
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
  const [muted] = useThemeColor(["muted"] as const);
  // An empty sheet is there to be typed into; a copied link is imported with one tap.
  const fieldRef = useFocusOnMount<ComponentRef<typeof SheetInput>>(!copiedUrl);
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

  const actions = useImportActions({
    isDisabled: trimmed === "",
    onAIImport: start(importRecipeWithAI),
    onImport: start(importRecipe),
  });

  return (
    <Sheet
      {...actions}
      name="import-link"
      title={intl.formatMessage({ id: "recipes.addRecipe.linkTitle" })}
    >
      <SheetBody>
        <TextField className="gap-2" isInvalid={isInvalid}>
          <SheetInput
            ref={fieldRef}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder={intl.formatMessage({ id: "common.import.url.placeholder" })}
            prefix={<Ionicons color={muted} name="link" size={18} />}
            returnKeyType="go"
            testID="import-link-field"
            textContentType="URL"
            value={link}
            onChangeText={changeLink}
            onClear={() => {
              changeLink("");
              fieldRef.current?.focus();
            }}
            onSubmitEditing={trimmed ? start(importRecipe) : undefined}
          />
          <FieldError className="px-2" testID="import-link-invalid">
            {intl.formatMessage({ id: "common.validation.invalidUrl" })}
          </FieldError>
        </TextField>
      </SheetBody>
    </Sheet>
  );
}
