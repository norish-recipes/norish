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
  useAIChangesQuery,
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

/** The catalogue of Ingredients (ADR-0037): a tree of kinds unless searched or filtered. */
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

  // A search or filter may match at any depth, so only the unfiltered list is a tree of roots.
  const { tree: asTree, ...searchFilters } = filters;
  const treeMode = asTree && !search && !hasIngredientFilters({ ...searchFilters, tree: true });
  // Not deferred: a search lands in a transition, and a deferred copy kept the old page's rows with
  // the new one's kinds folded in.
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
  // The panel follows its food's row, and reads it on its own once a filter drops the row.
  const openItem = openId ? (shown.find((item) => item.id === openId) ?? null) : null;

  const [changesOpen, setChangesOpen] = useState(false);
  const { total, unsure } = useAIChangesQuery((changes) => ({
    total: changes.length,
    unsure: changes.filter(isOpenChange).length,
  }));

  return (
    <div className="flex flex-col gap-6">
      <SettingsCard
        actions={
          total > 0 ? (
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

        {isLoading || (isPlaceholderData && items.length === 0) ? (
          // The tab skeleton's rows, until the first page or a changed filter's first answer lands.
          <div aria-busy className="flex flex-col gap-4" data-testid="ingredients-loading">
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
