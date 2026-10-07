"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { useTRPC } from "@/app/providers/trpc-provider";
import { IngredientIconsProvider } from "@/components/ingredients/ingredient-icon";
import { IngredientPanel } from "@/components/ingredients/ingredient-panel";
import { useIngredientSuggestions } from "@/components/ingredients/use-ingredient-suggestions";
import { AIButton } from "@/components/shared/ai-button";
import { usePermissionsContext } from "@/context/permissions-context";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { FunnelIcon } from "@heroicons/react/16/solid";
import { BookOpenIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { Button, Spinner } from "@heroui/react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import type { ReviewScope } from "@norish/shared/contracts/ingredient-catalogue";
import type { ReviewRound } from "@norish/shared/contracts/realtime/ingredients";
import { useRealtimeSubscription } from "@norish/shared-react/realtime";

import type { IngredientFilters } from "./ingredient-filters-panel";
import { AskAIRoundModal } from "./ask-ai-round-modal";
import DataSourcesCard from "./data-sources-card";
import { DrawIconsControl, useIconRound } from "./draw-icons-control";
import {
  DEFAULT_INGREDIENT_FILTERS,
  hasIngredientFilters,
  IngredientFiltersPanel,
} from "./ingredient-filters-panel";
import { IngredientList } from "./ingredient-list";
import { IngredientSearch } from "./ingredient-search";
import { SuggestionsPanel } from "./suggestions-panel";
import { useIngredientTree } from "./use-ingredient-tree";

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
export default function IngredientsSettingsContent() {
  const t = useTranslations("settings.ingredients");
  const tFilters = useTranslations("common.filters");
  // AI buttons go with AI: with it off for the instance, nothing here offers it.
  const { isAIEnabled } = usePermissionsContext();
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<IngredientFilters>(DEFAULT_INGREDIENT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // A link from elsewhere (a recipe's "Not counted") opens one food's panel.
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<string | null>(() => searchParams.get("ingredient"));
  const [isPending, startTransition] = useTransition();
  // A new search re-renders the rows at background priority, as the toggle does.
  const onSearch = useCallback((next: string) => startTransition(() => setSearch(next)), []);

  // With nothing typed and no other filter on, the list is the tree of kinds:
  // the foods filed under none, each folding its kinds out. A search or a
  // filter finds a food at any depth, so it lists flat, as it does when the
  // filters panel says flat.
  const { tree: asTree, ...searchFilters } = filters;
  const treeMode = asTree && !search && !hasIngredientFilters({ ...searchFilters, tree: true });
  const { data, isLoading, isFetching, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteQuery(
      trpc.ingredients.list.infiniteQueryOptions(
        { search: search || undefined, ...searchFilters, rootsOnly: treeMode || undefined, locale },
        { getNextPageParam: (page) => page.nextCursor, placeholderData: keepPreviousData }
      )
    );
  // The rows are not deferred: a search lands in a transition already, and a
  // deferred copy of a keyed list that a transition is replacing was seen to
  // keep the old page on screen with the new one's kinds folded into it.
  const items = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data?.pages]);
  const settling = isPending || (isFetching && !isFetchingNextPage);
  // The end of a short list is in view as the list is read again (a search
  // cleared, an edit landed): asking for the next page then must not cancel
  // that read, or the first page keeps what it had before it.
  const loadMore = useCallback(() => void fetchNextPage({ cancelRefetch: false }), [fetchNextPage]);
  const tree = useIngredientTree(items, treeMode, locale);
  // Every food on screen, the folded-out kinds included.
  const shown = useMemo(() => tree.rows.map((row) => row.item), [tree.rows]);
  // The open panel follows its food through the list: a refresh, a housemate's
  // edit or AI's answer shows there too. The panel keeps the last version it
  // saw when a filter drops the row, and closes on its own merge or delete.
  const openItem = useMemo(
    () => (openId ? (shown.find((item) => item.id === openId) ?? null) : null),
    [shown, openId]
  );

  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.list.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.kinds.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.suggestions.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.reviewScope.pathKey() }),
        queryClient.invalidateQueries({ queryKey: trpc.ingredients.reviewReport.pathKey() }),
      ]),
    [queryClient, trpc]
  );

  // Asking AI about the flagged foods is one job on the server, a step per
  // food, that outlives this tab. Which foods is asked first, in a dialog: the
  // catalogue's, not the screen's, so a round may be every flagged food there
  // is. The page watches the round over the socket: each answer lands as a
  // suggestion waiting on a person, and the round's count follows. A round is
  // the instance's, so a tab opened mid-round, or a housemate's, shows the
  // same count and is not offered a second round.
  const startRound = useMutation(trpc.ingredients.reviewAllWithAI.mutationOptions());
  const roundQuery = useQuery(trpc.ingredients.reviewRound.queryOptions());
  const [round, setRound] = useState<ReviewRound | null>(null);
  const [startedJobId, setStartedJobId] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  // The last round this tab saw end: what it got no suggestion for rides along with the suggestions.
  const [reportJobId, setReportJobId] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const { suggestions } = useIngredientSuggestions();
  const running = round?.finished ? null : (round ?? roundQuery.data ?? null);
  // The dialog is offered while the list holds a flagged food the viewer may edit.
  const hasFlagged = shown.some((item) => item.flagged && item.canEdit);
  // Under the standalone filter, the round asks what each food is a kind of instead.
  const standaloneIds = filters.standaloneOnly
    ? shown.filter((item) => !item.parent && item.canEdit).map((item) => item.id)
    : [];
  // Each flagged row shows its own turn in the round rather than a count above the list.
  const reviewing = useMemo(() => new Set(running?.pending ?? []), [running?.pending]);
  // A Draw icons round, likewise: each food it has still to draw shows its turn in its icon's place.
  const iconRound = useIconRound(() => void refresh());
  const drawing = useMemo(
    () => new Set(iconRound.running?.pending ?? []),
    [iconRound.running?.pending]
  );

  useRealtimeSubscription<ReviewRound>(trpc.ingredients.onReview, {
    lagQueryKeys: [trpc.ingredients.reviewRound.queryKey()],
    onEvent: (payload) => {
      setRound(payload);
      // What the round has written down shows as it goes: its suggestions, the flags it updated.
      void refresh();
      if (!payload.finished) return;
      void queryClient.invalidateQueries({ queryKey: trpc.ingredients.reviewRound.queryKey() });
      // What AI suggests opens for whoever asked; everyone else sees the count in the header.
      if (payload.jobId !== startedJobId) return;
      setStartedJobId(null);
      setReportJobId(payload.jobId);
      setSuggestionsOpen(true);
    },
  });

  /** Start a round and watch it: every food it asks about shows its turn until the round ends. */
  const startAndWatch = async (input: Parameters<typeof startRound.mutateAsync>[0]) => {
    try {
      const started = await startRound.mutateAsync(input);

      setStartedJobId(started.jobId);
      setRound({
        jobId: started.jobId,
        done: 0,
        total: started.total,
        counts: { merge: 0, parent: 0, distinct: 0, unsure: 0, skipped: 0, failed: 0 },
        pending: started.pending,
        finished: false,
      });

      return true;
    } catch (error) {
      showSafeErrorToast({
        title: t("errors.title"),
        description: t("errors.unknown"),
        error,
        context: "ingredients:review-all",
      });

      return false;
    }
  };

  // The server picks the foods for the scope, however many: the dialog closes once the round is on.
  const askAIAboutFlagged = async (scope: ReviewScope) => {
    if (await startAndWatch({ mode: "review", scope })) setAskOpen(false);
  };

  return (
    // The rows carry their icons; the provider says whether the reader hid them.
    <IngredientIconsProvider>
      <div className="flex flex-col gap-6">
        <SettingsCard
          actions={
            <>
              {suggestions.length > 0 || reportJobId ? (
                <Button
                  data-testid="ingredients-suggestions-open"
                  size="sm"
                  variant="tertiary"
                  onPress={() => setSuggestionsOpen(true)}
                >
                  <SparklesIcon className="size-4" />
                  {t("suggestionsOpen", { count: suggestions.length })}
                </Button>
              ) : null}
              {running ? (
                // A round in progress takes the place of the buttons that start one, and opens what it has done so far.
                <Button
                  data-testid="ingredients-round-progress"
                  size="sm"
                  variant="tertiary"
                  onPress={() => setSuggestionsOpen(true)}
                >
                  <Spinner color="current" size="sm" />
                  <span className="tabular-nums">
                    {t("roundProgress", { done: running.done, total: running.total })}
                  </span>
                </Button>
              ) : null}
              {isAIEnabled && standaloneIds.length > 0 && !running ? (
                <AIButton
                  data-testid="ingredients-find-parents-all"
                  isDisabled={startRound.isPending}
                  size="sm"
                  variant="tertiary"
                  onPress={() =>
                    void startAndWatch({ mode: "parent", ingredientIds: standaloneIds })
                  }
                >
                  {t("findParentsAll")}
                </AIButton>
              ) : null}
              <DrawIconsControl round={iconRound} />
              {isAIEnabled && hasFlagged && !running ? (
                <AIButton
                  data-testid="ingredients-ask-ai-all"
                  isDisabled={startRound.isPending}
                  size="sm"
                  variant="tertiary"
                  onPress={() => setAskOpen(true)}
                >
                  {t("askAIAll")}
                </AIButton>
              ) : null}
            </>
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

          {!isLoading && items.length === 0 ? (
            <p className="text-muted py-6 text-center" data-testid="ingredients-empty">
              {filters.flaggedOnly ? t("emptyFlagged") : t("empty")}
            </p>
          ) : (
            <IngredientList
              drawing={drawing}
              hasMore={hasNextPage}
              isFetchingMore={isFetchingNextPage}
              loadMore={loadMore}
              reviewing={reviewing}
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
          reviewing={openId !== null && reviewing.has(openId)}
          onChanged={refresh}
          onClose={() => setOpenId(null)}
        />
        <AskAIRoundModal
          isOpen={askOpen}
          isStarting={startRound.isPending}
          onClose={() => setAskOpen(false)}
          onStart={(scope) => void askAIAboutFlagged(scope)}
        />
        <SuggestionsPanel
          jobId={reportJobId}
          round={running}
          open={suggestionsOpen}
          reviewing={reviewing}
          onChanged={refresh}
          onClose={() => setSuggestionsOpen(false)}
        />
      </div>
    </IngredientIconsProvider>
  );
}
