import type {
  NativeStackHeaderItem,
  NativeStackHeaderItemMenuAction,
  NativeStackHeaderItemMenuSubmenu,
} from "expo-router/native-stack";
import { useCardActions } from "@/hooks/use-card-actions";
import { useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { RecipeEnrichmentKind } from "@norish/shared/lib/recipe-enrichment";
import {
  ownerAllows,
  useActiveAllergies,
  useHiddenItemVisibility,
  usePermissions,
  useRecipePermissions,
} from "@norish/shared-react/reader";
import {
  useFavoritesQuery,
  useLoadedPageRecipe,
  usePageEnrichment,
  usePageServings,
  useRecipePageStore,
} from "@norish/shared-react/recipes";

/** The AI actions a reader who may edit can ask for, in the order web's menu lists them. */
const AI_ACTIONS = [
  ["auto-tagging", "autoTag", "autoTagging"],
  ["auto-categorization", "autoCategorize", "autoCategorizing"],
  ["allergy-detection", "detectAllergies", "detectingAllergies"],
  ["nutrition-estimation", "estimateNutrition", "estimatingNutrition"],
  ["recipe-provenance", "inferProvenance", "inferringProvenance"],
  ["ingredient-linking", "linkIngredients", "linkingIngredients"],
  ["image-generation", "generateImage", "generatingImage"],
] as const satisfies readonly (readonly [RecipeEnrichmentKind, string, string])[];

/** The header's two items: the favourite heart and the actions menu; the heart is a Hidden Item. */
export function useRecipeHeaderItems(): NativeStackHeaderItem[] {
  const intl = useIntl();
  const router = useRouter();
  const recipe = useLoadedPageRecipe();
  const actions = useCardActions();
  const enrichment = usePageEnrichment();
  const servings = usePageServings();
  const keepAwake = useRecipePageStore((state) => state.wakeLock !== "off");
  const setWakeLock = useRecipePageStore((state) => state.setWakeLock);
  const { isFavorite } = useFavoritesQuery();
  const { canEditRecipe } = useRecipePermissions();
  const { showFavorites } = useHiddenItemVisibility();
  const { allergies } = useActiveAllergies();
  const isAIEnabled = usePermissions((p) => p.isAIEnabled);
  const label = (id: string) => intl.formatMessage({ id });
  const favourite = isFavorite(recipe.id);
  const canEdit = ownerAllows(recipe.userId, canEditRecipe);

  const ai = AI_ACTIONS.filter(
    ([kind]) => kind !== "allergy-detection" || allergies.length > 0
  ).map(([kind, idle, busy]) => {
    const state = enrichment.states[kind];
    const running = state === "queued" || state === "processing";

    return {
      type: "action" as const,
      label: label(`recipes.actions.${running ? busy : idle}`),
      subtitle: state === "idle" ? undefined : label(`recipes.enrichment.states.${state}`),
      icon: { type: "sfSymbol" as const, name: "sparkles" as const },
      disabled: running,
      onPress: () => enrichment.request(kind),
    };
  });

  const menu: (NativeStackHeaderItemMenuAction | NativeStackHeaderItemMenuSubmenu)[] = [
    ...(canEdit
      ? [
          {
            type: "action" as const,
            label: label("recipes.actions.share"),
            icon: { type: "sfSymbol" as const, name: "link" as const },
            onPress: () =>
              router.push({ pathname: "/recipe/[id]/share", params: { id: recipe.id } }),
          },
        ]
      : []),
    {
      type: "action" as const,
      label: label("recipes.selection.addToCookbook"),
      icon: { type: "sfSymbol" as const, name: "book" as const },
      onPress: () => actions.addToCookbook(recipe),
    },
    {
      type: "action" as const,
      label: label("recipes.actions.plan"),
      icon: { type: "sfSymbol" as const, name: "calendar" as const },
      onPress: () => actions.plan(recipe),
    },
    {
      type: "action" as const,
      label: label("recipes.detail.addToGroceries"),
      icon: { type: "sfSymbol" as const, name: "bag" as const },
      onPress: () => actions.addToGroceries(recipe, servings),
    },
    {
      type: "action" as const,
      label: label(keepAwake ? "recipes.actions.screenOn" : "recipes.actions.keepScreenOn"),
      icon: { type: "sfSymbol" as const, name: "iphone" as const },
      state: keepAwake ? ("on" as const) : ("off" as const),
      onPress: () => setWakeLock(keepAwake ? "off" : "held"),
    },
    ...(isAIEnabled && canEdit
      ? [
          {
            type: "submenu" as const,
            label: label("recipes.actions.ai"),
            icon: { type: "sfSymbol" as const, name: "sparkles" as const },
            items: ai,
          },
        ]
      : []),
    ...(actions.canDelete(recipe)
      ? [
          {
            type: "action" as const,
            label: label("recipes.actions.delete"),
            icon: { type: "sfSymbol" as const, name: "trash" as const },
            destructive: true,
            onPress: () => actions.deleteRecipe(recipe, () => router.back()),
          },
        ]
      : []),
  ];

  return [
    ...(showFavorites
      ? [
          {
            type: "button" as const,
            label: label(favourite ? "recipes.actions.unfavourite" : "recipes.actions.favourite"),
            icon: {
              type: "sfSymbol" as const,
              name: favourite ? ("heart.fill" as const) : ("heart" as const),
            },
            identifier: "recipe-favourite",
            onPress: () => actions.toggleFavourite(recipe),
          },
        ]
      : []),
    {
      type: "menu" as const,
      label: label("recipes.actions.actionsLabel"),
      icon: { type: "sfSymbol" as const, name: "ellipsis" as const },
      identifier: "recipe-menu",
      menu: { items: menu },
    },
  ];
}
