"use client";

import { useCallback, useDeferredValue, useMemo, useState, useTransition } from "react";
import UiSwitch from "@/app/(app)/settings/components/settings-switch";
import { useTRPC } from "@/app/providers/trpc-provider";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { BookOpenIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { Button, Card, toast } from "@heroui/react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import DataSourcesCard from "./data-sources-card";
import { IngredientPanel } from "./ingredient-panel";
import { IngredientRow } from "./ingredient-row";
import { IngredientSearch } from "./ingredient-search";

/**
 * The catalogue of Ingredients (ADR-0037): every food Norish knows, folded to
 * a line each, with the ones Norish was not sure about marked and told why.
 * A row opens the food's panel, where its spellings and edits live; an
 * action the viewer may not take is not offered. The list stays on screen
 * while a search runs, as the dashboard's does, and re-renders in the
 * background so typing never waits on it.
 */
export default function IngredientsSettingsContent() {
  const t = useTranslations("settings.ingredients");
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // A new search re-renders the rows at background priority, as the toggle does.
  const onSearch = useCallback((next: string) => startTransition(() => setSearch(next)), []);

  const { data, isLoading, isFetching, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery(
      trpc.ingredients.list.infiniteQueryOptions(
        { search: search || undefined, flaggedOnly, locale },
        { getNextPageParam: (page) => page.nextCursor, placeholderData: keepPreviousData }
      )
    );
  // The rows render at background priority: a keystroke or a toggle paints
  // first, and the list catches up, as the dashboard's grid does.
  const items = useDeferredValue(
    useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data?.pages])
  );
  const settling = isPending || (isFetching && !isFetchingNextPage);
  // The open panel follows its food through the list: a refresh, a housemate's
  // edit or AI's answer shows there too. The panel keeps the last version it
  // saw when a filter drops the row, and closes on its own merge or delete.
  const openItem = useMemo(
    () => (openId ? (items.find((item) => item.id === openId) ?? null) : null),
    [items, openId]
  );

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: trpc.ingredients.list.pathKey() }),
    [queryClient, trpc]
  );

  // Asking AI about every flagged food on screen, one after another, so the
  // page can say how far it is and each answer lands as its own row change.
  const review = useMutation(trpc.ingredients.reviewWithAI.mutationOptions());
  const [reviewed, setReviewed] = useState<{ done: number; total: number } | null>(null);
  const flaggedIds = items.filter((item) => item.flagged && item.canEdit).map((item) => item.id);

  const askAIAboutAll = async () => {
    const total = flaggedIds.length;
    const counts = { merged: 0, parent: 0, distinct: 0, unsure: 0 };

    setReviewed({ done: 0, total });
    try {
      for (const [index, ingredientId] of flaggedIds.entries()) {
        const outcome = await review.mutateAsync({ ingredientId });

        if (outcome.outcome !== "not-flagged") counts[outcome.outcome] += 1;
        setReviewed({ done: index + 1, total });
      }
      toast(t("askAIAllDone", counts), {
        variant: counts.unsure === total ? "warning" : "success",
      });
    } catch (error) {
      showSafeErrorToast({
        title: t("errors.title"),
        description: t("errors.unknown"),
        error,
        context: "ingredients:review-all",
      });
    } finally {
      setReviewed(null);
      await refresh();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <Card.Header>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <BookOpenIcon className="h-5 w-5" />
            {t("title")}
          </h2>
        </Card.Header>
        <Card.Content className="gap-4">
          <p className="text-muted text-base">{t("description")}</p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <IngredientSearch busy={settling} onSearch={onSearch} />
            <UiSwitch
              data-testid="ingredients-flagged-only"
              isSelected={flaggedOnly}
              onValueChange={(selected) => startTransition(() => setFlaggedOnly(selected))}
            >
              <span className="text-sm">{t("flaggedOnly")}</span>
            </UiSwitch>
          </div>
          <p className="text-muted -mt-2 text-xs" data-testid="ingredients-search-hint">
            {t("searchHint")}
          </p>

          {flaggedIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                data-testid="ingredients-ask-ai-all"
                isDisabled={reviewed !== null}
                isPending={reviewed !== null}
                size="sm"
                variant="secondary"
                onPress={() => void askAIAboutAll()}
              >
                <SparklesIcon className="size-4" />
                {t("askAIAll", { count: flaggedIds.length })}
              </Button>
              {reviewed ? (
                <span className="text-muted text-sm" data-testid="ingredients-ask-ai-progress">
                  {t("askAIProgress", reviewed)}
                </span>
              ) : null}
            </div>
          ) : null}

          {!isLoading && items.length === 0 ? (
            <p className="text-muted py-6 text-center" data-testid="ingredients-empty">
              {flaggedOnly ? t("emptyFlagged") : t("empty")}
            </p>
          ) : (
            <ul
              className={`border-border divide-border divide-y rounded-xl border transition-opacity ${settling ? "opacity-60" : ""}`}
              data-testid="ingredients-list"
            >
              {items.map((item) => (
                <IngredientRow key={item.id} item={item} onOpen={setOpenId} />
              ))}
            </ul>
          )}

          {hasNextPage ? (
            <Button
              className="self-center"
              isDisabled={isFetchingNextPage}
              variant="secondary"
              onPress={() => void fetchNextPage()}
            >
              {t("loadMore")}
            </Button>
          ) : null}
        </Card.Content>
      </Card>
      <DataSourcesCard />

      <IngredientPanel
        item={openItem}
        open={openId !== null}
        onChanged={refresh}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
