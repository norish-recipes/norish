import React from "react";
import { CardSlice } from "@/components/card-slice";
import { CountCardSkeleton, CountRow } from "@/components/count-row";
import { EmptyCard } from "@/components/empty-card";
import { PillButton } from "@/components/pill-button";
import { FitSheet, Sheet, SheetList } from "@/components/sheet";
import { edgeAt } from "@/lib/card-edges";
import { useText } from "@/lib/i18n/use-text";
import { recipeRoute } from "@/lib/tab-routes";
import { useLocalSearchParams, useRouter } from "expo-router";

import type { PickerKind } from "@norish/shared-react/lists";
import { useFoodRecipes } from "@norish/shared-react/ingredients";
import { useEntryRecipes } from "@norish/shared-react/lists";

import { useEntryRoute } from "../hooks/use-entry-route";

/** The household's recipes carrying one entry of a list, or using one food (`kind` ingredient);
 * a tap opens the recipe. */
export function ContentUsesScreen() {
  const { kind, id } = useLocalSearchParams<{ kind?: string; id?: string }>();

  return kind === "ingredient" ? <FoodUses id={id ?? ""} /> : <EntryUses />;
}

function EntryUses() {
  const { kind, id } = useEntryRoute();

  return kind ? <EntryRecipesSheet id={id} kind={kind} /> : null;
}

function EntryRecipesSheet({ kind, id }: { kind: PickerKind; id: string }) {
  return <UsesSheet recipes={useEntryRecipes(kind, id)} />;
}

function FoodUses({ id }: { id: string }) {
  return <UsesSheet recipes={useFoodRecipes(id)} />;
}

function UsesSheet({
  recipes: { recipes, loaded, failed, retry, hasMore, loadingMore, loadMore },
}: {
  recipes: ReturnType<typeof useEntryRecipes>;
}) {
  const text = useText();
  const router = useRouter();
  const open = (recipeId: string) => {
    router.dismissAll();
    router.push(recipeRoute(recipeId));
  };
  const title = text("settings.content.panel.usedBy");

  if (failed || !loaded || recipes.length === 0) {
    return (
      <FitSheet name="content-uses" title={title}>
        {failed ? (
          <EmptyCard
            action={{
              label: text("common.actions.retry"),
              icon: "refresh-outline",
              testID: "content-uses-retry",
              onPress: retry,
            }}
            icon="alert-circle-outline"
            placement="sheet"
            testID="content-uses-failed"
            title={text("settings.content.loadFailed")}
          />
        ) : !loaded ? (
          <CountCardSkeleton rows={3} />
        ) : (
          <EmptyCard
            icon="book-outline"
            placement="sheet"
            testID="content-uses-empty"
            title={text("settings.content.recipes", { count: 0 })}
          />
        )}
      </FitSheet>
    );
  }

  return (
    <Sheet name="content-uses" title={title}>
      <SheetList
        ListFooterComponent={
          hasMore ? (
            <PillButton
              centred
              label={text(loadingMore ? "common.status.loading" : "recipes.cookbooks.showMore")}
              testID="content-uses-more"
              onPress={loadMore}
            />
          ) : undefined
        }
        data={recipes}
        keyExtractor={(recipe) => recipe.id}
        renderItem={({ item, index }) => (
          <CardSlice edge={edgeAt(index, recipes.length)}>
            <CountRow
              name={item.name}
              testID={`content-uses-${item.id}`}
              onPress={() => open(item.id)}
            />
          </CardSlice>
        )}
        testID="content-uses-list"
      />
    </Sheet>
  );
}
