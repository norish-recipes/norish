import React, { useCallback, useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { ShellSheet } from "@/components/shell/sheet";
import { colorStyles, subSheetStyles } from "@/components/shell/sheet/add-recipe-sheet.styles";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesContext } from "@/context/recipes-context";
import { canShowAIAction } from "@/lib/permissions/mobile-action-visibility";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

interface ImportFromUrlSheetProps {
  isPresented: boolean;
  onIsPresentedChange: (open: boolean) => void;
  onDone: () => void;
}

export function ImportFromUrlSheet({
  isPresented,
  onIsPresentedChange,
  onDone,
}: ImportFromUrlSheetProps) {
  const intl = useIntl();
  const [url, setUrl] = useState("");
  const { importRecipe, importRecipeWithAI } = useRecipesContext();
  const { isAIEnabled, isLoading: isLoadingPermissions } = usePermissionsContext();
  const [foregroundColor, mutedColor, accentForegroundColor, backgroundColor, separatorColor] =
    useThemeColor(["foreground", "muted", "accent-foreground", "background", "separator"] as const);

  useEffect(() => {
    if (!isPresented) {
      setUrl("");
      return;
    }

    let mounted = true;

    const fillFromClipboard = async () => {
      try {
        const hasString = await Clipboard.hasStringAsync();

        if (!hasString || !mounted) return;

        const text = await Clipboard.getStringAsync();

        if (!mounted) return;

        if (/^https?:\/\/.+/i.test(text.trim())) {
          setUrl(text.trim());
        }
      } catch {}
    };

    void fillFromClipboard();

    return () => {
      mounted = false;
    };
  }, [isPresented]);

  const isValidUrl = /^https?:\/\/.+/i.test(url.trim());
  const showAIActions = canShowAIAction({
    isAIEnabled,
    isLoadingPermissions,
  });

  const handleImport = useCallback(() => {
    if (!isValidUrl) return;
    importRecipe(url.trim());
    onDone();
  }, [importRecipe, isValidUrl, onDone, url]);

  const handleAIImport = useCallback(() => {
    if (!isValidUrl || !showAIActions) return;
    importRecipeWithAI(url.trim());
    onDone();
  }, [importRecipeWithAI, isValidUrl, onDone, showAIActions, url]);

  return (
    <ShellSheet
      isPresented={isPresented}
      onIsPresentedChange={onIsPresentedChange}
      detents={["medium"]}
      initialDetent="medium"
    >
      <View style={subSheetStyles.container}>
        <Text style={[subSheetStyles.title, colorStyles.text(foregroundColor)]}>
          {intl.formatMessage({ id: "common.import.url.title" })}
        </Text>
        <Text style={[subSheetStyles.subtitle, colorStyles.text(mutedColor)]}>
          {intl.formatMessage({ id: "common.import.url.label" })}
        </Text>

        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder={intl.formatMessage({ id: "common.import.url.placeholder" })}
          placeholderTextColor={mutedColor}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          selectTextOnFocus
          style={[
            subSheetStyles.textInput,
            colorStyles.input(foregroundColor, backgroundColor, separatorColor),
          ]}
        />

        <View style={subSheetStyles.actionRow}>
          {showAIActions ? (
            <View style={subSheetStyles.actionButtonSlot}>
              <Button
                variant="primary"
                size="lg"
                className="w-full overflow-hidden"
                isDisabled={!isValidUrl}
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
          <View style={subSheetStyles.actionButtonSlot}>
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              isDisabled={!isValidUrl}
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
