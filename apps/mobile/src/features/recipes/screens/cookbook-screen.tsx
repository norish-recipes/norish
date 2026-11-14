import React from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { useDevicePreference } from "@norish/shared-react/reader";
import {
  useCookbookList,
  useCookbookQuery,
  useCookbookTitleEdit,
} from "@norish/shared-react/recipes";

import { CookbookHero, CookbookHeroSkeleton } from "../components/cookbook-hero";
import { LibraryCards } from "../components/library-cards";
import { LibraryHeader } from "../components/library-header";
import { LibrarySkeleton } from "../components/library-skeleton";
import { CookbookNoRecipes } from "../components/library-states";
import { RecipeCard } from "../components/recipe-card";
import { useCardActionMenu } from "../hooks/use-card-action-menu";
import { useCardActions } from "../hooks/use-card-actions";
import { useCookbookCoverPicker } from "../hooks/use-cookbook-cover-picker";
import { COOKBOOK_ACTION_DEFINITIONS, cookbookPageActions } from "../utils/card-actions";

/** What the cookbook page shows until the cookbook is read: the hero's and the cards' shells. */
function CookbookPageSkeleton() {
  const [variant] = useDevicePreference("recipeViewMode");

  return (
    <View className="bg-background flex-1" testID="cookbook-screen">
      <CookbookHeroSkeleton />
      <LibraryHeader scoped />
      <LibrarySkeleton variant={variant} />
    </View>
  );
}

function CookbookNotFound() {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <View
      className="bg-background flex-1 items-center justify-center gap-2 px-10"
      testID="cookbook-not-found"
    >
      <Ionicons color={muted} name="book-outline" size={40} />
      <Text className="text-foreground text-xl font-semibold">
        {intl.formatMessage({ id: "recipes.cookbooks.notFound" })}
      </Text>
      <Text className="text-muted text-center text-[15px]">
        {intl.formatMessage({ id: "recipes.cookbooks.notFoundHint" })}
      </Text>
    </View>
  );
}

/** The header's menu: the cookbook's own actions, which the cards' long press shares. */
function useCookbookMenu(cookbook: CookbookSummaryDTO) {
  const router = useRouter();
  const actions = useCardActions();
  const { saveCover, coverDisabled } = useCookbookCover(cookbook);
  const { items } = useCardActionMenu(
    cookbookPageActions({
      canEdit: actions.canEdit(cookbook),
      canDelete: actions.canDelete(cookbook),
    }),
    (key) => COOKBOOK_ACTION_DEFINITIONS[key],
    {
      addRecipes: () => actions.addRecipes(cookbook),
      rename: () => actions.renameCookbook(cookbook),
      changeCover: saveCover,
      delete: () => actions.deleteCookbook(cookbook, () => router.back()),
    }
  );

  return items.map(({ key, label, icon, destructive, onPress }) => ({
    type: "action" as const,
    label,
    icon: icon ? { type: "sfSymbol" as const, name: icon } : undefined,
    destructive,
    disabled: key === "changeCover" && coverDisabled,
    onPress,
  }));
}

/** Picks a cover and saves it at once; off while Offline, as covers are uploaded. */
function useCookbookCover(cookbook: CookbookSummaryDTO) {
  const { save, coverDisabled } = useCookbookTitleEdit(cookbook);

  return { saveCover: useCookbookCoverPicker((file) => void save(file)), coverDisabled };
}

function CookbookPage({ cookbook }: { cookbook: CookbookSummaryDTO }) {
  const intl = useIntl();
  const { recipes, isLoading, isFetchingNextPage, loadMore } = useCookbookList(cookbook.id);
  const menu = useCookbookMenu(cookbook);

  return (
    <LibraryCards
      cookbook={cookbook}
      empty={<CookbookNoRecipes />}
      header={
        <>
          <Stack.Screen
            options={{
              unstable_headerRightItems: () =>
                menu.length === 0
                  ? []
                  : [
                      {
                        type: "menu",
                        label: intl.formatMessage({ id: "recipes.cookbooks.options" }),
                        icon: { type: "sfSymbol", name: "ellipsis" },
                        identifier: "cookbook-menu",
                        menu: { items: menu },
                      },
                    ],
            }}
          />
          <CookbookHero cookbook={cookbook} />
          {cookbook.memberCount > 0 ? <LibraryHeader scoped /> : null}
        </>
      }
      fadeHeight={{ rest: 130, scrolled: 130 }}
      isFetchingNextPage={isFetchingNextPage}
      isLoading={isLoading}
      renderCard={(recipe, { variant, actions, allergies, isFavorite }) => (
        <RecipeCard
          actions={actions}
          allergies={allergies}
          isFavorite={isFavorite(recipe.id)}
          recipe={recipe}
          variant={variant}
        />
      )}
      rowKey={(recipe) => recipe.id}
      rows={recipes}
      testID="cookbook-screen"
      onEndReached={loadMore}
    />
  );
}

/** A cookbook's page: the Library scoped to it, under its cover and title. */
export function CookbookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cookbook, isNotFound } = useCookbookQuery(id ?? "");

  if (isNotFound) return <CookbookNotFound />;

  return cookbook ? (
    <CookbookPage key={cookbook.id} cookbook={cookbook} />
  ) : (
    <CookbookPageSkeleton />
  );
}
