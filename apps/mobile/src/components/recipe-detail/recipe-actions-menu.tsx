import React, { useCallback, useMemo, useState } from "react";
import { Alert, Linking, Share } from "react-native";
import { ShellMenu } from "@/components/shell/menu";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesContext } from "@/context/recipes-context";
import { Button as UIButton, Divider as UIDivider } from "@expo/ui/swift-ui";
import * as KeepAwake from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { RecipeDetailContextValue } from "@norish/shared-react/hooks";

type RecipeActionsMenuProps = {
  /** Recipe context — passed as a prop because the native header renders outside the RecipeDetailProvider tree. */
  ctx: RecipeDetailContextValue;
};

/**
 * Recipe-specific actions menu rendered in the header right slot.
 *
 * Native SwiftUI Menu via the ShellMenu component with SF Symbols.
 * Menu items mirror the web's actions-menu.tsx behaviour.
 *
 * Accepts the recipe context as a prop because React Native Screens
 * renders header components outside the page's React subtree.
 */
export function RecipeActionsMenu({ ctx }: RecipeActionsMenuProps) {
  const intl = useIntl();
  const router = useRouter();

  const {
    recipe,
    convertingTo,
    isAutoTagging,
    triggerAutoTag,
    triggerAutoCategorize,
    isDetectingAllergies,
    triggerAllergyDetection,
    isEstimatingNutrition,
    estimateNutrition,
    startConversion,
    allergies,
  } = ctx;

  const { deleteRecipe } = useRecipesContext();
  const {
    canEditRecipe,
    canDeleteRecipe,
    isAIEnabled,
    isAutoTaggingEnabled,
    isLoading: isLoadingPermissions,
  } = usePermissionsContext();

  // --- Keep Screen On ---
  const [isScreenKeptOn, setIsScreenKeptOn] = useState(false);

  const toggleKeepAwake = useCallback(() => {
    if (isScreenKeptOn) {
      KeepAwake.deactivateKeepAwake();
    } else {
      KeepAwake.activateKeepAwake();
    }
    setIsScreenKeptOn((prev) => !prev);
  }, [isScreenKeptOn]);

  // --- Share ---
  const handleShare = useCallback(async () => {
    if (!recipe) return;
    try {
      await Share.share({
        message: recipe.url ? `${recipe.name}\n${recipe.url}` : recipe.name,
        title: recipe.name,
        url: recipe.url ?? undefined,
      });
    } catch {
      // User cancelled or share failed – silently ignore
    }
  }, [recipe]);

  // --- Visit Original ---
  const handleVisitOriginal = useCallback(async () => {
    if (!recipe?.url) return;

    try {
      await Linking.openURL(recipe.url);
    } catch {
      Alert.alert(
        intl.formatMessage({ id: "auth.errors.default.title" }),
        intl.formatMessage({ id: "recipes.actions.visitOriginal" })
      );
    }
  }, [recipe?.url, intl]);

  // --- Delete ---
  const handleDelete = useCallback(() => {
    if (!recipe) return;
    Alert.alert(
      intl.formatMessage({ id: "recipes.deleteModal.title" }),
      intl.formatMessage({ id: "recipes.deleteModal.confirmMessage" }, { recipeName: recipe.name }),
      [
        {
          text: intl.formatMessage({ id: "recipes.deleteModal.title" }),
          style: "destructive",
          onPress: () => {
            deleteRecipe(recipe.id, recipe.version);
            router.back();
          },
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  }, [intl, recipe, deleteRecipe, router]);

  // --- Convert ---
  // Check which measurement systems already exist in the recipe's ingredients
  // (mirrors web's system-convert-menu logic)
  const availableSystems = useMemo(
    () => Array.from(new Set((recipe?.recipeIngredients ?? []).map((ri: any) => ri.systemUsed))),
    [recipe?.recipeIngredients]
  );

  // Use the effective system (convertingTo takes precedence while conversion is in flight)
  const effectiveSystem = convertingTo ?? recipe?.systemUsed ?? "metric";
  const targetSystem = effectiveSystem === "metric" ? "us" : "metric";

  // Only show the convert button if the target system data already exists (instant switch)
  // OR if AI is enabled (AI-powered conversion)
  const targetRequiresAI = !availableSystems.includes(targetSystem);
  const canConvert = !targetRequiresAI || isAIEnabled;

  const handleConvert = useCallback(() => {
    if (!recipe || convertingTo != null) return; // block while converting
    startConversion(targetSystem);
  }, [recipe, convertingTo, targetSystem, startConversion]);

  // The menu is only rendered when recipe is loaded, but TypeScript doesn't know that.
  if (!recipe) return null;

  // Derive permission booleans
  const canEdit = !isLoadingPermissions && (recipe.userId ? canEditRecipe(recipe.userId) : true);
  const canDelete =
    !isLoadingPermissions && (recipe.userId ? canDeleteRecipe(recipe.userId) : true);
  const hasAllergies = allergies.length > 0;

  return (
    <ShellMenu
      label={intl.formatMessage({ id: "recipes.detail.recipeActions" })}
      systemImage="ellipsis"
    >
      {/* Core actions */}
      <UIButton
        label={intl.formatMessage({ id: "recipes.actions.addToCalendar" })}
        systemImage="calendar.badge.plus"
        onPress={() => Alert.alert("Calendar", "Meal planning coming soon!")}
      />
      <UIButton
        label={intl.formatMessage({ id: "recipes.detail.addToGroceries" })}
        systemImage="cart.badge.plus"
        onPress={() => Alert.alert("Groceries", "Add to groceries coming soon!")}
      />
      <UIButton
        label={intl.formatMessage({ id: "recipes.actions.share" })}
        systemImage="square.and.arrow.up"
        onPress={handleShare}
      />
      {recipe.url ? (
        <UIButton
          label={intl.formatMessage({ id: "recipes.actions.visitOriginal" })}
          systemImage="arrow.up.right.square"
          onPress={handleVisitOriginal}
        />
      ) : null}

      <UIDivider />

      {/* Edit / management */}
      {canEdit ? (
        <UIButton
          label={intl.formatMessage({ id: "recipes.actions.edit" })}
          systemImage="pencil"
          onPress={() => Alert.alert("Edit", "Recipe editing coming soon!")}
        />
      ) : null}
      {canConvert ? (
        <UIButton
          label={
            convertingTo != null
              ? `${intl.formatMessage({ id: targetSystem === "us" ? "recipes.convert.toUS" : "recipes.convert.toMetric" })}…`
              : intl.formatMessage({
                  id: targetSystem === "us" ? "recipes.convert.toUS" : "recipes.convert.toMetric",
                })
          }
          systemImage="arrow.left.arrow.right"
          onPress={handleConvert}
        />
      ) : null}
      <UIButton
        label={intl.formatMessage({
          id: isScreenKeptOn ? "recipes.actions.screenOn" : "recipes.actions.keepScreenOn",
        })}
        systemImage="iphone"
        onPress={toggleKeepAwake}
      />

      {/* AI actions — only shown when AI is enabled */}
      {(isAutoTaggingEnabled || isAIEnabled) && canEdit ? <UIDivider /> : null}

      {isAutoTaggingEnabled && canEdit ? (
        <UIButton
          label={intl.formatMessage({
            id: isAutoTagging ? "recipes.actions.autoTagging" : "recipes.actions.autoTag",
          })}
          systemImage="sparkles"
          onPress={triggerAutoTag}
        />
      ) : null}
      {isAIEnabled && canEdit ? (
        <UIButton
          label={intl.formatMessage({ id: "recipes.actions.autoCategorize" })}
          systemImage="sparkles"
          onPress={() => triggerAutoCategorize()}
        />
      ) : null}
      {isAIEnabled && canEdit && hasAllergies ? (
        <UIButton
          label={intl.formatMessage({
            id: isDetectingAllergies
              ? "recipes.actions.detectingAllergies"
              : "recipes.actions.detectAllergies",
          })}
          systemImage="sparkles"
          onPress={triggerAllergyDetection}
        />
      ) : null}
      {isAIEnabled && canEdit ? (
        <UIButton
          label={intl.formatMessage({
            id: isEstimatingNutrition
              ? "recipes.actions.estimatingNutrition"
              : "recipes.actions.estimateNutrition",
          })}
          systemImage="sparkles"
          onPress={estimateNutrition}
        />
      ) : null}

      {/* Destructive */}
      {canDelete ? <UIDivider /> : null}
      {canDelete ? (
        <UIButton
          label={intl.formatMessage({ id: "recipes.deleteModal.title" })}
          systemImage="trash"
          onPress={handleDelete}
        />
      ) : null}
    </ShellMenu>
  );
}
