import React, { useCallback, useMemo, useState } from "react";
import { Alert, Linking, Share } from "react-native";
import { shareRecipeFromMenu } from "@/components/recipe-detail/recipe-share";
import { ShellMenu } from "@/components/shell/menu";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesContext } from "@/context/recipes-context";
import { getCurrentBaseUrl } from "@/providers/trpc-provider";
import { Button as UIButton, Divider as UIDivider } from "@expo/ui/swift-ui";
import { disabled as disabledModifier } from "@expo/ui/swift-ui/modifiers";
import * as KeepAwake from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { RecipeDetailContextValue } from "@norish/shared-react/hooks";
import type { RecipeEnrichmentKind } from "@norish/shared/lib/recipe-enrichment";

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
    enrichment,
    startConversion,
    allergies,
    createShare,
    isCreatingShare,
  } = ctx;

  const { deleteRecipe } = useRecipesContext();
  const {
    canEditRecipe,
    canDeleteRecipe,
    isAIEnabled,
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
    if (!recipe || isCreatingShare) return;

    try {
      await shareRecipeFromMenu({
        recipeName: recipe.name,
        baseUrl: getCurrentBaseUrl(),
        createShare,
        nativeShare: Share.share,
      });
    } catch {
      Alert.alert(
        intl.formatMessage({ id: "auth.errors.default.title" }),
        intl.formatMessage({ id: "common.errors.operationFailed" })
      );
    }
  }, [createShare, intl, isCreatingShare, recipe]);

  // --- Visit Original ---
  const recipeUrl = recipe?.url;
  const handleVisitOriginal = useCallback(async () => {
    if (!recipeUrl) return;

    try {
      await Linking.openURL(recipeUrl);
    } catch {
      Alert.alert(
        intl.formatMessage({ id: "auth.errors.default.title" }),
        intl.formatMessage({ id: "recipes.actions.visitOriginal" })
      );
    }
  }, [recipeUrl, intl]);

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
  const enrichmentLabel = (kind: RecipeEnrichmentKind, actionId: string) => {
    const action = intl.formatMessage({ id: actionId });
    const state = enrichment.states[kind];

    return state === "idle"
      ? action
      : `${action} — ${intl.formatMessage({ id: `recipes.enrichment.states.${state}` })}`;
  };

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
        label={
          isCreatingShare
            ? `${intl.formatMessage({ id: "recipes.actions.share" })}…`
            : intl.formatMessage({ id: "recipes.actions.share" })
        }
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
      {isAIEnabled && canEdit ? <UIDivider /> : null}

      {isAIEnabled && canEdit ? (
        <UIButton
          label={enrichmentLabel("auto-tagging", "recipes.actions.autoTag")}
          modifiers={[disabledModifier(enrichment.isBusy("auto-tagging"))]}
          systemImage="sparkles"
          onPress={() => enrichment.request("auto-tagging")}
        />
      ) : null}
      {isAIEnabled && canEdit ? (
        <UIButton
          label={enrichmentLabel("auto-categorization", "recipes.actions.autoCategorize")}
          modifiers={[disabledModifier(enrichment.isBusy("auto-categorization"))]}
          systemImage="sparkles"
          onPress={() => enrichment.request("auto-categorization")}
        />
      ) : null}
      {isAIEnabled && canEdit && hasAllergies ? (
        <UIButton
          label={enrichmentLabel("allergy-detection", "recipes.actions.detectAllergies")}
          modifiers={[disabledModifier(enrichment.isBusy("allergy-detection"))]}
          systemImage="sparkles"
          onPress={() => enrichment.request("allergy-detection")}
        />
      ) : null}
      {isAIEnabled && canEdit ? (
        <UIButton
          label={enrichmentLabel("nutrition-estimation", "recipes.actions.estimateNutrition")}
          modifiers={[disabledModifier(enrichment.isBusy("nutrition-estimation"))]}
          systemImage="sparkles"
          onPress={() => enrichment.request("nutrition-estimation")}
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
