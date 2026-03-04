import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, useThemeColor } from 'heroui-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { colorStyles, subSheetStyles } from '@/components/shell/sheet/add-recipe-sheet.styles';
import { ShellSheet } from '@/components/shell/sheet';
import { usePermissionsContext } from '@/context/permissions-context';
import { useRecipesContext } from '@/context/recipes-context';
import { canShowAIAction } from '@/lib/permissions/mobile-action-visibility';

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
  const [text, setText] = useState('');
  const { importRecipeWithAI } = useRecipesContext();
  const { isAIEnabled, isLoading: isLoadingPermissions } = usePermissionsContext();
  const [foregroundColor, mutedColor, accentForegroundColor, surfaceColor, separatorColor] = useThemeColor([
    'foreground',
    'muted',
    'accent-foreground',
    'surface-secondary',
    'separator',
  ] as const);

  useEffect(() => {
    if (!isPresented) {
      setText('');
    }
  }, [isPresented]);

  const hasText = !!text.trim();
  const showAIActions = canShowAIAction({
    isAIEnabled,
    isLoadingPermissions,
  });

  const handleImport = useCallback(() => {
    if (!hasText || !showAIActions) return;
    importRecipeWithAI(text.trim());
    onDone();
  }, [importRecipeWithAI, onDone, showAIActions, text, hasText]);

  return (
    <ShellSheet
      isPresented={isPresented}
      onIsPresentedChange={onIsPresentedChange}
      detents={['large']}
      initialDetent="large"
    >
      <View style={subSheetStyles.container}>
        <Text style={[subSheetStyles.title, colorStyles.text(foregroundColor)]}>
          Start from Scratch
        </Text>
        <Text style={[subSheetStyles.subtitle, colorStyles.text(mutedColor)]}>
          Paste or type a recipe. We'll structure it for you.
        </Text>

        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Paste your recipe here..."
          placeholderTextColor={mutedColor}
          multiline
          textAlignVertical="top"
          style={[
            subSheetStyles.textArea,
            colorStyles.input(foregroundColor, surfaceColor, separatorColor),
          ]}
        />

        {showAIActions ? (
          <View className="flex-row gap-2.5">
            <Button
              variant="primary"
              size="lg"
              className="flex-1 overflow-hidden"
              isDisabled={!hasText}
              onPress={handleImport}
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
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              isDisabled={!hasText}
              onPress={handleImport}
            >
              <Ionicons name="arrow-down-circle-outline" size={20} color={accentForegroundColor} />
              <Button.Label>Import</Button.Label>
            </Button>
          </View>
        ) : null}
      </View>
    </ShellSheet>
  );
}
