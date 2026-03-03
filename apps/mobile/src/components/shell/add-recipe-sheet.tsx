import Ionicons from '@expo/vector-icons/Ionicons';
import { useThemeColor } from 'heroui-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ShellSheet } from '@/components/shell/sheet';

interface AddRecipeSheetProps {
  isPresented: boolean;
  onIsPresentedChange: (value: boolean) => void;
}

/**
 * Sheet that opens when the user taps "Add Recipe".
 *
 * Uses ShellSheet which handles the Host positioning correctly so it doesn't
 * consume layout space and cause the half-height bug.
 *
 * Content is placeholder until the real "create recipe" flow is built.
 */
export function AddRecipeSheet({ isPresented, onIsPresentedChange }: AddRecipeSheetProps) {
  const [foregroundColor, mutedColor, separatorColor] = useThemeColor([
    'foreground',
    'muted',
    'separator',
  ] as const);

  return (
    <ShellSheet
      isPresented={isPresented}
      onIsPresentedChange={onIsPresentedChange}
      detents={['medium']}
      initialDetent="medium"
    >
      <View style={styles.container}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="restaurant-outline" size={40} color={mutedColor} />
        </View>

        {/* Heading */}
        <Text style={[styles.title, { color: foregroundColor }]}>Add Recipe</Text>
        <Text style={[styles.subtitle, { color: mutedColor }]}>
          Import from a URL, scan a photo, or start from scratch.
        </Text>

        {/* Placeholder options */}
        <View style={[styles.optionList, { borderColor: separatorColor }]}>
          <PlaceholderOption
            icon="link-outline"
            label="Import from URL"
            description="Paste a link to any recipe website"
            foregroundColor={foregroundColor}
            mutedColor={mutedColor}
            separatorColor={separatorColor}
            showDivider
          />
          <PlaceholderOption
            icon="camera-outline"
            label="Scan a photo"
            description="Extract a recipe from an image"
            foregroundColor={foregroundColor}
            mutedColor={mutedColor}
            separatorColor={separatorColor}
            showDivider
          />
          <PlaceholderOption
            icon="create-outline"
            label="Start from scratch"
            description="Build your recipe step by step"
            foregroundColor={foregroundColor}
            mutedColor={mutedColor}
            separatorColor={separatorColor}
            showDivider={false}
          />
        </View>
      </View>
    </ShellSheet>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function PlaceholderOption({
  icon,
  label,
  description,
  foregroundColor,
  mutedColor,
  separatorColor,
  showDivider,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  description: string;
  foregroundColor: string;
  mutedColor: string;
  separatorColor: string;
  showDivider: boolean;
}) {
  return (
    <>
      <View style={styles.option}>
        <Ionicons name={icon} size={22} color={mutedColor} style={styles.optionIcon} />
        <View style={styles.optionText}>
          <Text style={[styles.optionLabel, { color: foregroundColor }]}>{label}</Text>
          <Text style={[styles.optionDescription, { color: mutedColor }]}>{description}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={separatorColor} />
      </View>
      {showDivider && <View style={[styles.divider, { backgroundColor: separatorColor }]} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  iconContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  optionList: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  optionIcon: {
    width: 24,
    textAlign: 'center',
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  optionDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
});
