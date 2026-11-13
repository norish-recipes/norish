import type { ComponentRef } from "react";
import React, { useEffect, useRef, useState } from "react";
import { Pressable } from "react-native";
import { Sheet, SheetBody } from "@/components/sheet";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, FieldError, InputGroup, Label, TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { usePermissions } from "@norish/shared-react/reader";
import { useImportRecipe } from "@norish/shared-react/recipes";

import { useStartOnce } from "../hooks/use-start-once";
import { isImportableLink } from "../utils/copied-link";

/** Import from a link: opened with the copied link when Add recipe had one, else empty and focused. */
export function ImportLinkScreen() {
  const intl = useIntl();
  const router = useRouter();
  const { url: copiedUrl } = useLocalSearchParams<{ url?: string }>();
  const [link, setLink] = useState(copiedUrl ?? "");
  const [isInvalid, setIsInvalid] = useState(false);
  const isAIEnabled = usePermissions((permissions) => permissions.isAIEnabled);
  const { importRecipe, importRecipeWithAI } = useImportRecipe({ stay: true });
  const startOnce = useStartOnce();
  const accentText = useAccentTextColor();
  const [muted, foreground, accentForeground] = useThemeColor([
    "muted",
    "foreground",
    "accent-foreground",
  ] as const);
  const fieldRef = useRef<ComponentRef<typeof InputGroup.Input>>(null);
  const trimmed = link.trim();

  // An empty sheet is there to be typed into; a copied link is imported with one tap.
  useEffect(() => {
    if (!copiedUrl) fieldRef.current?.focus();
  }, [copiedUrl]);

  // A link that can't be opened is said under the field and starts nothing.
  const start = (run: (url: string) => void) =>
    startOnce(() => {
      if (!isImportableLink(trimmed)) {
        setIsInvalid(true);

        return false;
      }
      run(trimmed);
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
                isDisabled={trimmed === ""}
                testID="import-link-ai"
                variant="secondary"
                onPress={start(importRecipeWithAI)}
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
              testID="import-link-submit"
              variant="primary"
              onPress={start(importRecipe)}
            >
              <Ionicons color={accentForeground} name="download-outline" size={18} />
              <Button.Label className="font-semibold">
                {intl.formatMessage({ id: "common.actions.import" })}
              </Button.Label>
            </Button>
          </Sheet.Action>
        </Sheet.Actions>
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
              className="bg-surface ios:shadow-none h-[52px] rounded-full text-base"
              keyboardType="url"
              placeholder={intl.formatMessage({ id: "common.import.url.placeholder" })}
              returnKeyType="go"
              testID="import-link-field"
              textContentType="URL"
              value={link}
              onChangeText={(value) => {
                setLink(value);
                setIsInvalid(false);
              }}
              onSubmitEditing={trimmed ? start(importRecipe) : undefined}
            />
            {link ? (
              <InputGroup.Suffix className="pr-3 pl-2">
                <Pressable
                  accessibilityLabel={intl.formatMessage({ id: "common.actions.clear" })}
                  accessibilityRole="button"
                  className="bg-default size-7 items-center justify-center rounded-full"
                  hitSlop={8}
                  testID="import-link-clear"
                  onPress={() => {
                    setLink("");
                    setIsInvalid(false);
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
