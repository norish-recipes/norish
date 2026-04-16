import React, { useCallback, useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { ShellSheet } from "@/components/shell/sheet";
import { colorStyles, subSheetStyles } from "@/components/shell/sheet/add-recipe-sheet.styles";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesMutations } from "@/hooks/recipes";
import { canShowAIAction } from "@/lib/permissions/mobile-action-visibility";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

interface StartFromScratchSheetProps {
  isPresented: boolean;
  onIsPresentedChange: (open: boolean) => void;
  onDone: () => void;
}

export function StartFromScratchSheet({
  isPresented,
  onIsPresentedChange,
  onDone,
}: StartFromScratchSheetProps) {
  const intl = useIntl();
  const [text, setText] = useState("");
  const { importRecipeFromPaste, importRecipeFromPasteWithAI } = useRecipesMutations();
  const { isAIEnabled, isLoading: isLoadingPermissions } = usePermissionsContext();
  const [foregroundColor, mutedColor, accentForegroundColor, surfaceColor, separatorColor] =
    useThemeColor([
      "foreground",
      "muted",
      "accent-foreground",
      "surface-secondary",
      "separator",
    ] as const);

  useEffect(() => {
    if (!isPresented) {
      setText("");
    }
  }, [isPresented]);

  const hasText = !!text.trim();
  const showAIActions = canShowAIAction({
    isAIEnabled,
    isLoadingPermissions,
  });

  const handleImport = useCallback(() => {
    if (!hasText) return;
    importRecipeFromPaste(text.trim());
    onDone();
  }, [hasText, importRecipeFromPaste, onDone, text]);

  const handleAIImport = useCallback(() => {
    if (!hasText || !showAIActions) return;
    importRecipeFromPasteWithAI(text.trim());
    onDone();
  }, [hasText, importRecipeFromPasteWithAI, onDone, showAIActions, text]);

  return (
    <ShellSheet
      isPresented={isPresented}
      onIsPresentedChange={onIsPresentedChange}
      detents={["large"]}
      initialDetent="large"
    >
      <View style={subSheetStyles.container}>
        <Text style={[subSheetStyles.title, colorStyles.text(foregroundColor)]}>
          {intl.formatMessage({ id: "common.import.paste.title" })}
        </Text>
        <Text style={[subSheetStyles.subtitle, colorStyles.text(mutedColor)]}>
          {intl.formatMessage({ id: "common.import.paste.label" })}
        </Text>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={intl.formatMessage({ id: "common.import.paste.placeholder" })}
          placeholderTextColor={mutedColor}
          multiline
          textAlignVertical="top"
          style={[
            subSheetStyles.textArea,
            colorStyles.input(foregroundColor, surfaceColor, separatorColor),
          ]}
        />

        <View style={showAIActions ? subSheetStyles.actionRow : undefined}>
          {showAIActions ? (
            <View style={subSheetStyles.actionButtonSlot}>
              <Button
                variant="primary"
                size="lg"
                className="w-full overflow-hidden"
                isDisabled={!hasText}
                onPress={handleAIImport}
              >
                <LinearGradient
                  colors={["#fb7185", "#d946ef", "#6366f1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={subSheetStyles.gradientFill}
                />
                <Ionicons name="flash-outline" size={18} color="#fff" />
                <Button.Label style={subSheetStyles.whiteLabel}>
                  {intl.formatMessage({ id: "common.actions.aiImport" })}
                </Button.Label>
              </Button>
            </View>
          ) : null}

          <View style={showAIActions ? subSheetStyles.actionButtonSlot : undefined}>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              isDisabled={!hasText}
              onPress={handleImport}
            >
              <Ionicons name="arrow-down-circle-outline" size={18} color={accentForegroundColor} />
              <Button.Label>{intl.formatMessage({ id: "common.actions.import" })}</Button.Label>
            </Button>
          </View>
        </View>
      </View>
    </ShellSheet>
  );
}
