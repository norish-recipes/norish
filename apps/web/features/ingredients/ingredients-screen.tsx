"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { IngredientPanel } from "@/components/ingredients/ingredient-panel";
import { SettingsCard } from "@/components/settings/settings-card";
import { ActionButton } from "@/components/shared/action-button";
import { FunnelIcon, SparklesIcon } from "@heroicons/react/16/solid";
import { BookOpenIcon } from "@heroicons/react/24/outline";
import { Button, Skeleton } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";

import { useIngredientsSubscription } from "@norish/shared-react/config";
import {
  isOpenChange,
  useAIChanges,
  useIngredientListQuery,
} from "@norish/shared-react/ingredients";

import type { IngredientFilters } from "./components/ingredient-filters-panel";
import { ChangedByAIPanel } from "./components/changed-by-ai-panel";
import DataSourcesCard from "./components/data-sources-card";
import {
  DEFAULT_INGREDIENT_FILTERS,
  hasIngredientFilters,
  IngredientFiltersPanel,
} from "./components/ingredient-filters-panel";
import { IngredientList } from "./components/ingredient-list";
import { IngredientSearch } from "./components/ingredient-search";
import { useIngredientTree } from "./hooks/use-ingredient-tree";

/**
 * The catalogue of Ingredients (ADR-0037): every food Norish knows, folded to
 * a line each, with the ones Norish was not sure about marked and told why.
 * With nothing typed and no filter on, the list is the tree of kinds: the
 * foods filed under none, each folding its kinds out beneath it. A search or
 * a filter lists flat, since a match may sit at any depth. A row opens the
 * food's panel, where its spellings and edits live; an action the viewer may
 * not take is not offered. The list stays on screen while a search runs, as
 * the dashboard's does, the search lands in a transition so typing never
 * waits on it, and it is virtualised with the next page fetched as the end
 * comes into view.
 */
export function IngredientsScreen() {
  const t = useTranslations("settings.ingredients");
  const tFilters = useTranslations("common.filters");
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<IngredientFilters>(DEFAULT_INGREDIENT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // A link from elsewhere (a recipe's "Not counted") opens one food's panel.
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(() => searchParams.get("ingredient"));
  const [isPending, startTransition] = useTransition();
  // A new search re-renders the rows at background priority, as the toggle does.
  const onSearch = (next: string) => startTransition(() => setSearch(next));

  useIngredientsSubscription();

  // With nothing typed and no other filter on, the list is the tree of kinds:
  // the foods filed under none, each folding its kinds out. A search or a
  // filter finds a food at any depth, so it lists flat, as it does when the
  // filters panel says flat.
  const { tree: asTree, ...searchFilters } = filters;
  const treeMode = asTree && !search && !hasIngredientFilters({ ...searchFilters, tree: true });
  // The rows are not deferred: a search lands in a transition already, and a
  // deferred copy of a keyed list that a transition is replacing was seen to
  // keep the old page on screen with the new one's kinds folded into it.
  const { items, isLoading, isPlaceholderData, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useIngredientListQuery({
      search: search || undefined,
      ...searchFilters,
      rootsOnly: treeMode || undefined,
      locale,
    });
  // Another search's rows standing in, not a reread of the rows showing.
  const settling = isPending || isPlaceholderData;
  const tree = useIngredientTree(items, treeMode, locale);
  // Every food on screen, the folded-out kinds included.
  const shown = tree.rows.map((row) => row.item);
  // The open panel follows its food through the list: a refresh, a housemate's
  // edit or AI's answer shows there too. The panel keeps the last version it
  // saw when a filter drops the row, and closes on its own merge or delete.
  const openItem = openId ? (shown.find((item) => item.id === openId) ?? null) : null;

  const [changesOpen, setChangesOpen] = useState(false);
  const { changes } = useAIChanges();
  const unsure = changes.filter(isOpenChange).length;

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard
        actions={
          changes.length > 0 ? (
            <ActionButton
              action="edit"
              data-testid="ingredients-ai-changes-open"
              icon={SparklesIcon}
              size="sm"
              onPress={() => setChangesOpen(true)}
            >
              {t("changedByAI.open", { count: unsure })}
            </ActionButton>
          ) : null
        }
        description={t("description")}
        icon={BookOpenIcon}
        title={t("title")}
      >
        <IngredientSearch
          busy={settling}
          suffix={
            <Button
              isIconOnly
              aria-label={tFilters("title")}
              // The dot alone says a filter is on.
              className="relative"
              data-testid="ingredients-filters"
              size="sm"
              variant="ghost"
              onPress={() => setFiltersOpen(true)}
            >
              <FunnelIcon className="size-4" />
              {hasIngredientFilters(filters) ? (
                <span className="bg-accent absolute top-1 right-1 inline-flex size-2 rounded-full" />
              ) : null}
            </Button>
          }
          onSearch={onSearch}
        />

        {isLoading ? (
          // The same rows the tab's skeleton draws, until the first page arrives.
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted py-6 text-center" data-testid="ingredients-empty">
            {filters.flaggedOnly ? t("emptyFlagged") : t("empty")}
          </p>
        ) : (
          <IngredientList
            hasMore={hasNextPage}
            isFetchingMore={isFetchingNextPage}
            loadMore={fetchNextPage}
            rows={tree.rows}
            settling={settling}
            onOpen={setOpenId}
            onToggleKinds={treeMode ? tree.toggle : undefined}
          />
        )}
      </SettingsCard>
      <DataSourcesCard />

      <IngredientFiltersPanel
        open={filtersOpen}
        value={filters}
        onApply={(next) => startTransition(() => setFilters(next))}
        onOpenChange={setFiltersOpen}
      />
      <IngredientPanel
        id={openId}
        item={openItem}
        open={openId !== null}
        onClose={() => setOpenId(null)}
      />
      <ChangedByAIPanel open={changesOpen} onClose={() => setChangesOpen(false)} />
    </div>
  );
}
