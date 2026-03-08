import { Button as UIButton, Divider as UIDivider } from '@expo/ui/swift-ui';
import React from 'react';
import { Alert } from 'react-native';
import { useIntl } from 'react-intl';

import { ShellMenu } from '@/components/shell/menu';

/**
 * Recipe-specific actions menu rendered in the header right slot.
 *
 * Native SwiftUI Menu via the ShellMenu component with SF Symbols.
 * Menu items mirror the web's actions-menu.tsx.
 */
export function RecipeActionsMenu() {
  const intl = useIntl();

  return (
    <ShellMenu
      label={intl.formatMessage({ id: 'recipes.detail.recipeActions' })}
      systemImage="ellipsis"
    >
      {/* Core actions */}
      <UIButton
        label={intl.formatMessage({ id: 'recipes.actions.addToCalendar' })}
        systemImage="calendar.badge.plus"
        onPress={() =>
          Alert.alert('Calendar', 'Added to your meal plan.')
        }
      />
      <UIButton
        label={intl.formatMessage({ id: 'recipes.detail.addToGroceries' })}
        systemImage="cart.badge.plus"
        onPress={() =>
          Alert.alert(
            'Groceries',
            'Ingredients added to your grocery list.',
          )
        }
      />
      <UIButton
        label={intl.formatMessage({ id: 'recipes.actions.share' })}
        systemImage="square.and.arrow.up"
        onPress={() => Alert.alert('Share', 'Sharing coming soon!')}
      />
      <UIButton
        label={intl.formatMessage({ id: 'recipes.actions.visitOriginal' })}
        systemImage="arrow.up.right.square"
        onPress={() =>
          Alert.alert('Original', 'Opening original recipe URL…')
        }
      />

      <UIDivider />

      {/* Edit / management */}
      <UIButton
        label={intl.formatMessage({ id: 'recipes.actions.edit' })}
        systemImage="pencil"
        onPress={() => Alert.alert('Edit', 'Editing coming soon!')}
      />
      <UIButton
        label={intl.formatMessage({ id: 'recipes.convert.toMetric' })}
        systemImage="arrow.left.arrow.right"
        onPress={() =>
          Alert.alert('Convert', 'Unit conversion coming soon!')
        }
      />
      <UIButton
        label={intl.formatMessage({ id: 'recipes.actions.keepScreenOn' })}
        systemImage="iphone"
        onPress={() =>
          Alert.alert('Screen On', 'Wake-lock toggled.')
        }
      />

      <UIDivider />

      {/* AI actions */}
      <UIButton
        label={intl.formatMessage({ id: 'recipes.actions.autoTag' })}
        systemImage="sparkles"
        onPress={() =>
          Alert.alert('Auto-Tag', 'AI auto-tagging coming soon!')
        }
      />
      <UIButton
        label={intl.formatMessage({ id: 'recipes.actions.autoCategorize' })}
        systemImage="sparkles"
        onPress={() =>
          Alert.alert(
            'Auto-Categorize',
            'AI categorization coming soon!',
          )
        }
      />
      <UIButton
        label={intl.formatMessage({ id: 'recipes.actions.detectAllergies' })}
        systemImage="sparkles"
        onPress={() =>
          Alert.alert(
            'Detect Allergies',
            'AI allergy detection coming soon!',
          )
        }
      />
      <UIButton
        label={intl.formatMessage({ id: 'recipes.actions.estimateNutrition' })}
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
        label={intl.formatMessage({ id: 'recipes.deleteModal.title' })}
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
