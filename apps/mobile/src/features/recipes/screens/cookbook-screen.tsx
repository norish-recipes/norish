import React from "react";
import { Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { useDevicePreference } from "@norish/shared-react/reader";
import {
  useCookbookEdit,
  useCookbookList,
  useCookbookQuery,
  useLibraryCards,
  useLibraryFilters,
} from "@norish/shared-react/recipes";
import { hasAppliedRecipeFilters } from "@norish/shared/contracts/filter-contract";

import { CardList } from "../components/card-list";
import { CookbookHero, CookbookHeroSkeleton } from "../components/cookbook-hero";
import { FiltersButton, ViewToggle } from "../components/library-header";
import { LibrarySkeleton } from "../components/library-skeleton";
import { CookbookNoRecipes, LibraryNoResults } from "../components/library-states";
import { RecipeCard } from "../components/recipe-card";
import { useCardActions } from "../hooks/use-card-actions";
import { useCookbookCoverPicker } from "../hooks/use-cookbook-cover-picker";
import { COOKBOOK_PAGE_DEFINITIONS, cookbookPageActions } from "../utils/cookbook-menu";

/** The view toggle and Filters button under the title, at the page's right. */
function Toolbar() {
  return (
    <View className="flex-row items-center justify-end gap-2 px-5 pt-[18px] pb-3.5">
      <ViewToggle />
      <FiltersButton />
    </View>
  );
}

/** What the cookbook page shows until the cookbook is read: the hero's and the cards' shells. */
function CookbookPageSkeleton() {
  const [variant] = useDevicePreference("recipeViewMode");

  return (
    <View className="bg-background flex-1" testID="cookbook-screen">
      <CookbookHeroSkeleton />
      <Toolbar />
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
  const intl = useIntl();
  const router = useRouter();
  const actions = useCardActions();
  const { saveCover, coverDisabled } = useCookbookCover(cookbook);
  const handlers = {
    addRecipes: () => actions.addRecipes(cookbook),
    rename: () => actions.renameCookbook(cookbook),
    changeCover: saveCover,
    delete: () => actions.deleteCookbook(cookbook, () => router.back()),
  };

  return cookbookPageActions({
    canEdit: actions.canEdit(cookbook),
    canDelete: actions.canDelete(cookbook),
  }).map((key) => {
    const { labelId, icon, destructive } = COOKBOOK_PAGE_DEFINITIONS[key];

    return {
      type: "action" as const,
      label: intl.formatMessage({ id: labelId }),
      icon: { type: "sfSymbol" as const, name: icon },
      destructive,
      disabled: key === "changeCover" && coverDisabled,
      onPress: handlers[key],
    };
  });
}

/** Picks a cover and saves it at once; off while Offline, as covers are uploaded. */
function useCookbookCover(cookbook: CookbookSummaryDTO) {
  const { save, coverDisabled } = useCookbookEdit(cookbook, { withMembers: false });

  return { saveCover: useCookbookCoverPicker((file) => void save(file)), coverDisabled };
}

function CookbookPage({ cookbook }: { cookbook: CookbookSummaryDTO }) {
  const intl = useIntl();
  const [variant] = useDevicePreference("recipeViewMode");
  const filters = useLibraryFilters((state) => state.filters);
  const clearFilters = useLibraryFilters((state) => state.clearFilters);
  const { isFavorite, allergies } = useLibraryCards();
  const cardActions = useCardActions();
  const { recipes, isLoading, isFetchingNextPage, loadMore, removeMember } = useCookbookList(
    cookbook.id
  );
  const menu = useCookbookMenu(cookbook);
  // The member list is this cookbook's own read, so a removal drops the card now rather than
  // waiting for a refetch that Offline never comes.
  const actions = {
    ...cardActions,
    removeFromCookbook: (
      from: CookbookSummaryDTO,
      recipe: Parameters<typeof cardActions.removeFromCookbook>[1]
    ) => {
      cardActions.removeFromCookbook(from, recipe);
      removeMember(recipe.id);
    },
  };

  return (
    <CardList
      empty={
        isLoading ? (
          <LibrarySkeleton variant={variant} />
        ) : hasAppliedRecipeFilters(filters) ? (
          <LibraryNoResults onClear={clearFilters} />
        ) : (
          <CookbookNoRecipes />
        )
      }
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
          <Toolbar />
        </>
      }
      isFetchingNextPage={isFetchingNextPage}
      renderCard={(recipe) => (
        <RecipeCard
          actions={actions}
          allergies={allergies}
          cookbook={cookbook}
          isFavorite={isFavorite(recipe.id)}
          recipe={recipe}
          variant={variant}
        />
      )}
      rowKey={(recipe) => recipe.id}
      rows={isLoading ? [] : recipes}
      testID="cookbook-screen"
      variant={variant}
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
