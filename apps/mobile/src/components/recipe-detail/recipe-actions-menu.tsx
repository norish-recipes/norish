import { Button as UIButton, Divider as UIDivider } from '@expo/ui/swift-ui';
import React from 'react';
import { Alert } from 'react-native';

import { ShellMenu } from '@/components/shell/menu';

/**
 * Recipe-specific actions menu rendered in the header right slot.
 *
 * Native SwiftUI Menu via the ShellMenu component with SF Symbols.
 * Menu items mirror the web's actions-menu.tsx.
 */
export function RecipeActionsMenu() {
  return (
    <ShellMenu label="Recipe Actions" systemImage="ellipsis">
      {/* Core actions */}
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
          Alert.alert(
            'Groceries',
            'Ingredients added to your grocery list.',
          )
        }
      />
      <UIButton
        label="Share Recipe"
        systemImage="square.and.arrow.up"
        onPress={() => Alert.alert('Share', 'Sharing coming soon!')}
      />
      <UIButton
        label="Visit Original Recipe"
        systemImage="arrow.up.right.square"
        onPress={() =>
          Alert.alert('Original', 'Opening original recipe URL…')
        }
      />

      <UIDivider />

      {/* Edit / management */}
      <UIButton
        label="Edit Recipe"
        systemImage="pencil"
        onPress={() => Alert.alert('Edit', 'Editing coming soon!')}
      />
      <UIButton
        label="Convert to Metric"
        systemImage="arrow.left.arrow.right"
        onPress={() =>
          Alert.alert('Convert', 'Unit conversion coming soon!')
        }
      />
      <UIButton
        label="Keep Screen On"
        systemImage="iphone"
        onPress={() =>
          Alert.alert('Screen On', 'Wake-lock toggled.')
        }
      />

      <UIDivider />

      {/* AI actions */}
      <UIButton
        label="Auto-Tag"
        systemImage="sparkles"
        onPress={() =>
          Alert.alert('Auto-Tag', 'AI auto-tagging coming soon!')
        }
      />
      <UIButton
        label="Auto-Categorize"
        systemImage="sparkles"
        onPress={() =>
          Alert.alert(
            'Auto-Categorize',
            'AI categorization coming soon!',
          )
        }
      />
      <UIButton
        label="Detect Allergies"
        systemImage="sparkles"
        onPress={() =>
          Alert.alert(
            'Detect Allergies',
            'AI allergy detection coming soon!',
          )
        }
      />
      <UIButton
        label="Estimate Nutrition"
        systemImage="sparkles"
        onPress={() =>
          Alert.alert(
            'Estimate Nutrition',
            'AI nutrition estimation coming soon!',
          )
        }
      />

      <UIDivider />

      {/* Destructive */}
      <UIButton
        label="Delete Recipe"
        systemImage="trash"
        onPress={() =>
          Alert.alert(
            'Delete',
            'Are you sure you want to delete this recipe?',
          )
        }
      />
    </ShellMenu>
  );
}
