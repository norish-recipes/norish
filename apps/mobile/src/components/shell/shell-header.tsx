import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useThemeColor } from 'heroui-native';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useUniwind } from 'uniwind';

import { useSettingsSheet } from '@/context/settings-sheet-context';

import { styles } from './shell-header.styles';

export function ShellHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const { openSettingsSheet } = useSettingsSheet();
  const { theme } = useUniwind();
  const [textColor, mutedColor, separatorColor] = useThemeColor([
    'foreground',
    'muted',
    'separator',
  ]);

  const button = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      onPress={openSettingsSheet}
      style={({ pressed }) => [
        styles.settingsButton,
        Platform.OS === 'ios' ? styles.settingsButtonIos : styles.settingsButtonDefault,
        pressed && styles.settingsButtonPressed,
      ]}
    >
      <Ionicons name="settings-outline" size={18} color={textColor} />
    </Pressable>
  );

  return (
    <View style={[styles.container, { borderBottomColor: separatorColor }]}>
      <View style={styles.copyBlock}>
        <Text style={[styles.title, { color: textColor }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: mutedColor }]}>{subtitle}</Text>
      </View>

      {Platform.OS === 'ios' ? (
        <View style={styles.glassWrap}>
          <BlurView
            intensity={45}
            tint={theme === 'dark' ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            style={styles.glassBlur}
          />
          {button}
        </View>
      ) : (
        button
      )}
    </View>
  );
}
