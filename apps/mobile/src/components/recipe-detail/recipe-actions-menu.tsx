import { Button as UIButton } from '@expo/ui/swift-ui';
import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { ActionSheetIOS, Alert, Pressable, StyleSheet } from 'react-native';

import { ShellMenu } from '@/components/shell/menu';

/**
 * Recipe-specific actions menu rendered in the header right slot.
 *
 * Uses a GlassView circle button wrapping a native SwiftUI Menu via
 * the ShellMenu component, giving us both the liquid glass aesthetic
 * and the native iOS context-menu behaviour with SF Symbols.
 */
export function RecipeActionsMenu() {
  return (
    <GlassView style={styles.glass} isInteractive>
      <ShellMenu
        label="Recipe Actions"
        systemImage="ellipsis"
      >
        <UIButton
          label="Add to Calendar"
          systemImage="calendar.badge.plus"
          onPress={() =>
            Alert.alert('Calendar', 'Added to your meal plan.')
          }
        />
        <UIButton
          label="Add to Groceries"
          systemImage="cart.badge.plus"
          onPress={() =>
            Alert.alert('Groceries', 'Ingredients added to your grocery list.')
          }
        />
        <UIButton
          label="Share Recipe"
          systemImage="square.and.arrow.up"
          onPress={() => Alert.alert('Share', 'Sharing coming soon!')}
        />
        <UIButton
          label="Print Recipe"
          systemImage="printer"
          onPress={() => Alert.alert('Print', 'Printing coming soon!')}
        />
        <UIButton
          label="Report Issue"
          systemImage="exclamationmark.triangle"
          onPress={() => Alert.alert('Report', 'Report feature coming soon!')}
        />
      </ShellMenu>
    </GlassView>
  );
}

const styles = StyleSheet.create({
  glass: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
