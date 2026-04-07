import React, { createContext, useContext, useMemo } from "react";
import { View } from "react-native";
import { useAuth } from "@/context/auth-context";
import { useRecipeFiltersContext } from "@/context/recipe-filters-context";
import {
  useFavoritesMutation,
  useFavoritesQuery,
  useRecipesMutations,
  useRecipesQuery,
  useRecipesSubscription,
} from "@/hooks/recipes";
import { sharedDashboardRecipeHooks } from "@/hooks/recipes/shared-recipe-hooks";
import { useUserAllergiesQuery } from "@/hooks/user";
import { mapDashboardRecipeToCardItem } from "@/lib/recipes/map-dashboard-recipe-to-card-item";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Toast, useThemeColor, useToast } from "heroui-native";
import { useIntl } from "react-intl";

import type { SharedRecipesContextValue } from "@norish/shared-react/contexts";
import { createIntlMessageTranslator } from "@norish/i18n";
import { createRecipesContext } from "@norish/shared-react/contexts";

const sharedRecipesContext = createRecipesContext({
  useRecipesFiltersContext: useRecipeFiltersContext,
  useRecipesQuery,
  useRecipesMutations,
  useFavoritesQuery,
  useFavoritesMutation,
  useUserAllergiesQuery,
  useRecipesSubscription,
  useRatingsSubscription: sharedDashboardRecipeHooks.useRatingsSubscription,
  useToastAdapter: () => {
    const intl = useIntl();
    const { toast } = useToast();
    const [successColor, warningColor, dangerColor] = useThemeColor([
      "success",
      "warning",
      "danger",
    ] as const);

    return {
      show: ({ severity, title, description, actionLabel, onActionPress }) => {
        const variant = severity === "default" ? "default" : severity;

        const iconName: React.ComponentProps<typeof Ionicons>["name"] =
          severity === "success"
            ? "checkmark-circle"
            : severity === "warning"
              ? "warning"
              : severity === "danger"
                ? "alert-circle"
                : "information-circle";

        // Use explicit color prop for Ionicons — className alone may not apply
        // correctly in all theme contexts. Default (import pending) toasts have
        // a dark background so the icon should be white to match the title text.
        const iconColor =
          severity === "success"
            ? successColor
            : severity === "warning"
              ? warningColor
              : severity === "danger"
                ? dangerColor
                : "#ffffff";

        toast.show({
          component: (props) => (
            <Toast variant={variant} {...props} className="flex-row items-center gap-3">
              <Ionicons name={iconName} size={24} color={iconColor} />
              <View className="flex-1 gap-0.5">
                <Toast.Title className="text-foreground">{title}</Toast.Title>
                {description ? (
                  <Toast.Description className="text-muted">{description}</Toast.Description>
                ) : null}
              </View>
              {actionLabel ? (
                <Toast.Action
                  onPress={() => {
                    onActionPress?.();
                    props.hide();
                  }}
                >
                  {actionLabel}
                </Toast.Action>
              ) : null}
            </Toast>
          ),
        });
      },
      translate: createIntlMessageTranslator((descriptor) => intl.formatMessage(descriptor)),
    };
  },
  useNavigationAdapter: () => {
    const router = useRouter();

    return {
      toHome: () => {},
      toRecipe: (id: string) => router.push(`/(tabs)/dashboard/recipe/${id}` as never),
    };
  },
});

type MobileRecipesContextValue = SharedRecipesContextValue & {
  recipeCards: ReturnType<typeof mapDashboardRecipeToCardItem>[];
};

const MobileRecipesContext = createContext<MobileRecipesContextValue | null>(null);

export function RecipesProvider({ children }: { children: React.ReactNode }) {
  return (
    <sharedRecipesContext.RecipesProvider>
      <MobileRecipesContextAdapter>{children}</MobileRecipesContextAdapter>
    </sharedRecipesContext.RecipesProvider>
  );
}

function MobileRecipesContextAdapter({ children }: { children: React.ReactNode }) {
  const base = sharedRecipesContext.useRecipesContext();
  const { backendBaseUrl, authClient } = useAuth();
  const favoriteSet = useMemo(() => new Set(base.favoriteIds), [base.favoriteIds]);
  const authCookie = ((authClient as any)?.getCookie?.() as string | undefined) ?? null;

  const recipeCards = useMemo(
    () =>
      base.recipes.map((recipe) =>
        mapDashboardRecipeToCardItem(recipe, backendBaseUrl, authCookie, {
          favoriteIds: favoriteSet,
          allergies: base.allergies,
        })
      ),
    [base.recipes, base.allergies, backendBaseUrl, authCookie, favoriteSet]
  );

  const value = useMemo<MobileRecipesContextValue>(
    () => ({
      ...base,
      recipeCards,
    }),
    [base, recipeCards]
  );

  return <MobileRecipesContext.Provider value={value}>{children}</MobileRecipesContext.Provider>;
}

export function useRecipesContext() {
  const context = useContext(MobileRecipesContext);

  if (!context) {
    throw new Error("useRecipesContext must be used within RecipesProvider");
  }

  return context;
}
