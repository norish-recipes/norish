import AntDesign from '@expo/vector-icons/AntDesign';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassView } from 'expo-glass-effect';
import { Button, useThemeColor } from 'heroui-native';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Sticky bottom action bar with liquid glass background.
 * Contains primary Cook action and secondary actions (groceries, share, save).
 */
export function RecipeActionBar() {
  const insets = useSafeAreaInsets();
  const [foregroundColor, accentColor, accentForegroundColor] = useThemeColor([
    'foreground',
    'accent',
    'accent-foreground',
  ] as const);

  const handleCook = () =>
    Alert.alert('Start Cooking', 'Cooking mode coming soon!');
  const handleGroceries = () =>
    Alert.alert(
      'Added to Groceries',
      'Ingredients added to your grocery list.',
    );
  const handleShare = () =>
    Alert.alert('Share', 'Sharing coming soon!');
  const handleSave = () =>
    Alert.alert('Saved', 'Recipe saved to your collection.');

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom + 8 }]}>
      <GlassView style={styles.glass}>
        <View style={styles.row}>
          {/* Primary action — Cook */}
          <Button
            feedbackVariant="scale"
            className="h-11 flex-1 rounded-[14px] flex-row items-center justify-center gap-1.5 bg-accent"
            onPress={handleCook}
          >
            <AntDesign name="fire" size={16} color={accentForegroundColor} />
            <Text
              style={[styles.cookText, { color: accentForegroundColor }]}
            >
              Cook
            </Text>
          </Button>

          {/* Secondary actions */}
          <Button
            variant="secondary"
            className="size-11 rounded-xl bg-surface-tertiary"
            isIconOnly
            onPress={handleGroceries}
          >
            <Ionicons
              name="cart-outline"
              size={18}
              color={foregroundColor}
            />
          </Button>
          <Button
            variant="secondary"
            className="size-11 rounded-xl bg-surface-tertiary"
            isIconOnly
            onPress={handleShare}
          >
            <Feather name="share" size={16} color={foregroundColor} />
          </Button>
          <Button
            variant="secondary"
            className="size-11 rounded-xl bg-surface-tertiary"
            isIconOnly
            onPress={handleSave}
          >
            <Feather name="heart" size={16} color={foregroundColor} />
          </Button>
        </View>
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  glass: {
    borderRadius: 22,
    padding: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cookText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
