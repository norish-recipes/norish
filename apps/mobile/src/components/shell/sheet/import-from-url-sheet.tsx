import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, useThemeColor } from 'heroui-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { colorStyles, subSheetStyles } from '@/components/shell/sheet/add-recipe-sheet.styles';
import { ShellSheet } from '@/components/shell/sheet';
import { usePermissionsContext } from '@/context/permissions-context';
import { useRecipesContext } from '@/context/recipes-context';
import { canShowAIAction } from '@/lib/permissions/mobile-action-visibility';

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
  const [url, setUrl] = useState('');
  const { importRecipe, importRecipeWithAI } = useRecipesContext();
  const { isAIEnabled, isLoading: isLoadingPermissions } = usePermissionsContext();
  const [foregroundColor, mutedColor, accentForegroundColor, backgroundColor, separatorColor] = useThemeColor([
    'foreground',
    'muted',
    'accent-foreground',
    'background',
    'separator',
  ] as const);

  useEffect(() => {
    if (!isPresented) {
      setUrl('');
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
      } catch {
      }
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
      detents={['medium']}
      initialDetent="medium"
    >
      <View style={subSheetStyles.container}>
        <Text style={[subSheetStyles.title, colorStyles.text(foregroundColor)]}>Import from URL</Text>
        <Text style={[subSheetStyles.subtitle, colorStyles.text(mutedColor)]}>
          Paste a link to any recipe website.
        </Text>

        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com/recipe"
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

        <View className="flex-row gap-2.5">
          {showAIActions ? (
            <Button
              variant="primary"
              size="lg"
              className="flex-1 overflow-hidden"
              isDisabled={!isValidUrl}
              onPress={handleAIImport}
            >
              <LinearGradient
                colors={['#fb7185', '#d946ef', '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={subSheetStyles.gradientFill}
              />
              <Ionicons name="flash-outline" size={20} color="#fff" />
              <Button.Label style={subSheetStyles.whiteLabel}>AI Import</Button.Label>
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            isDisabled={!isValidUrl}
            onPress={handleImport}
          >
            <Ionicons name="arrow-down-circle-outline" size={20} color={accentForegroundColor} />
            <Button.Label>Import</Button.Label>
          </Button>
        </View>
      </View>
    </ShellSheet>
  );
}
