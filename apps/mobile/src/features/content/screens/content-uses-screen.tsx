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
import { useEntryRecipes } from "@norish/shared-react/lists";

/** The household's recipes carrying one entry, a page at a time; a tap opens the recipe. */
export function ContentUsesScreen() {
  const text = useText();
  const router = useRouter();
  const { kind, id } = useLocalSearchParams<{ kind: PickerKind; id: string }>();
  const { recipes, loaded, failed, retry, hasMore, loadingMore, loadMore } = useEntryRecipes(
    kind,
    id
  );
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
