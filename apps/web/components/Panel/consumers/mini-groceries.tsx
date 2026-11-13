"use client";

import { useEffect, useRef, useState } from "react";
import { IngredientIcon } from "@/components/ingredients/ingredient-icon";
import { OnTheListMark } from "@/components/ingredients/on-the-list-mark";
import Panel from "@/components/Panel/Panel";
import { isCheckboxEvent, RoundCheckbox } from "@/components/round-checkbox";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";
import { ArchiveBoxArrowDownIcon } from "@heroicons/react/16/solid";
import { Button, Input, toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { FoodToBuy, LineWithFoods } from "@norish/shared/lib/line-foods";
import { useSpellingRules } from "@norish/shared-react/config";
import {
  useGroceriesMutations,
  useGroceriesPantryAndCatalogueSubscriptions,
  useOnTheList,
  usePantryMutations,
  usePantryQuery,
} from "@norish/shared-react/groceries";
import { useIngredientIcons } from "@norish/shared-react/ingredients";
import {
  formatServings,
  useLinkedRecipeIngredients,
  useRecipeIngredients,
  useRecipeSubscription,
  useServingsScaler,
} from "@norish/shared-react/recipes";
import { foodsToBuy } from "@norish/shared/lib/line-foods";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";

type MiniGroceriesProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  initialServings?: number;
  originalServings?: number;
  /**
   * Put the lines to buy on the list without showing the panel, then close:
   * what "Add ingredients to groceries" after planning does. The panel opens
   * only where it has something to say, as when the Pantry cannot be read.
   */
  addAtOnce?: boolean;
};

type GroceryIngredient = LineWithFoods & {
  id: string;
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  systemUsed: string;
  order: number;
};

type EditedIngredient = {
  name: string;
  amount: number | null;
  unit: string | null;
};

function extractLinkedRecipeIds(ingredients: GroceryIngredient[]) {
  const ids = new Set<string>();

  for (const ingredient of ingredients) {
    const name = ingredient.ingredientName ?? "";

    for (const match of name.matchAll(/\[[^[\]]+\]\(id:([a-zA-Z0-9-]+)\)/g)) {
      if (match[1]) ids.add(match[1]);
    }
  }

  return Array.from(ids);
}

function isGroceryIngredient(ingredient: GroceryIngredient) {
  const name = ingredient.ingredientName?.trim() ?? "";

  return !name.startsWith("#") && !name.includes("(id:") && name && ingredient.ingredientId;
}

function parseAmountToken(token: string | undefined) {
  if (!token) return null;

  if (/^\d+\/\d+$/.test(token)) {
    const [numerator, denominator] = token.split("/").map(Number);

    return denominator ? numerator! / denominator : null;
  }

  const value = Number(token);

  return Number.isFinite(value) ? value : null;
}

function parseEditedIngredientLine(value: string, fallback: GroceryIngredient): EditedIngredient {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const firstAmount = parseAmountToken(parts[0]);
  let amount: number | null = fallback.amount ?? null;
  let unit: string | null = fallback.unit ?? null;
  let nameStart = 0;

  if (firstAmount !== null) {
    amount = firstAmount;
    nameStart = 1;

    const mixedFraction = parseAmountToken(parts[1]);

    if (mixedFraction !== null && parts[1]?.includes("/")) {
      amount += mixedFraction;
      nameStart = 2;
    }

    if (fallback.unit && parts[nameStart]) {
      unit = parts[nameStart] ?? null;
      nameStart += 1;
    }
  }

  const name = parts.slice(nameStart).join(" ").trim() || fallback.ingredientName;

  return { amount, unit, name };
}

function formatEditableIngredient(item: GroceryIngredient) {
  return [item.amount, item.unit, item.ingredientName].filter(Boolean).join(" ");
}

/**
 * A recipe's foods to buy at the servings picked, each line as edited here, split by whether the
 * Pantry holds it; and what puts lines on the list.
 */
function useLinesToBuy(
  recipeId: string,
  originalServings: number,
  initialServings: number,
  editedIngredients: Record<string, EditedIngredient>
) {
  const t = useTranslations("groceries.panel");
  const { createGroceriesFromData } = useGroceriesMutations();
  const { ingredients: rawIngredients, systemUsed, isLoading } = useRecipeIngredients(recipeId);
  const { ingredients: linkedIngredients, isLoading: linkedLoading } = useLinkedRecipeIngredients(
    extractLinkedRecipeIds(rawIngredients as GroceryIngredient[]),
    systemUsed
  );
  // One row per food a line puts on the list: each of an "and" line's, an "or" line's first.
  const ingredients = foodsToBuy(
    [
      ...(rawIngredients as GroceryIngredient[]),
      ...(linkedIngredients as GroceryIngredient[]),
    ].filter(isGroceryIngredient)
  );
  const scaler = useServingsScaler(ingredients, originalServings, initialServings);
  // A line whose food the Pantry holds is shown apart and left off the list unless ticked; a line
  // edited here is only text, so it is matched by its name.
  const pantry = usePantryQuery();
  const rules = useSpellingRules();

  /** The Pantry Ingredient that covers a line, as edited here if it was. */
  const keptFor = (item: GroceryIngredient) => {
    const edited = editedIngredients[item.id]?.name;

    return pantryIngredientFor(
      pantry.items,
      edited === undefined ? item : { ingredientName: edited },
      rules
    );
  };
  const toBuy: typeof scaler.scaledIngredients = [];
  const inPantry: typeof scaler.scaledIngredients = [];

  for (const item of scaler.scaledIngredients) (keptFor(item) ? inPantry : toBuy).push(item);

  /** Puts these lines on the list, as edited here; true once they are on it. */
  const addLines = (lines: Array<FoodToBuy<GroceryIngredient>>) =>
    createGroceriesFromData(
      lines.map((ri) => ({
        name: editedIngredients[ri.id]?.name ?? ri.ingredientName,
        amount: editedIngredients[ri.id]?.amount ?? ri.amount,
        unit: editedIngredients[ri.id]?.unit ?? ri.unit ?? null,
        isDone: false,
        recipeIngredientId: ri.lineId,
      }))
    )
      .then(() => {
        toast(t("ingredientsAdded"), { variant: "success" });

        return true;
      })
      .catch(() => {
        toast(t("ingredientsFailed"), { variant: "warning" });

        return false;
      });

  return {
    ...scaler,
    isLoading,
    linkedLoading,
    pantry,
    keptFor,
    toBuy,
    inPantry,
    addLines,
  };
}

type LinesProps = {
  recipeId: string;
  initialServings: number;
  originalServings: number;
  onOpenChange: (open: boolean) => void;
};

/* Adds what the panel would have ticked once the recipe has answered and the Pantry was read in
   this mount, never from a cached copy; a Pantry that cannot be read opens the panel instead. */
function AddAtOnce({
  recipeId,
  initialServings,
  originalServings,
  onOpenChange,
  onDone,
}: LinesProps & { onDone: () => void }) {
  const { isLoading, linkedLoading, pantry, toBuy, addLines } = useLinesToBuy(
    recipeId,
    originalServings,
    initialServings,
    {}
  );
  const addedRef = useRef(false);
  const ready = !isLoading && !linkedLoading && !pantry.isLoading && !pantry.isFetching;

  useEffect(() => {
    if (!ready || addedRef.current) return;
    addedRef.current = true;
    onDone();
    if (pantry.isUnavailable) onOpenChange(true);
    else if (toBuy.length === 0) onOpenChange(false);
    else void addLines(toBuy).finally(() => onOpenChange(false));
  });

  return null;
}

/** The panel's content, mounted while it is open: each opening starts from what is to buy. */
function MiniGroceriesContent({
  recipeId,
  initialServings,
  originalServings,
  onOpenChange,
}: LinesProps) {
  const t = useTranslations("groceries.panel");
  const tActions = useTranslations("common.actions");
  const tDetail = useTranslations("recipes.detail");
  const { formatAmountUnit } = useUnitFormatter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editedIngredients, setEditedIngredients] = useState<Record<string, EditedIngredient>>({});
  const {
    isLoading,
    servings,
    scaledIngredients,
    incrementServings,
    decrementServings,
    pantry,
    keptFor,
    toBuy,
    inPantry,
    addLines,
  } = useLinesToBuy(recipeId, originalServings, initialServings, editedIngredients);

  useGroceriesPantryAndCatalogueSubscriptions();
  useRecipeSubscription(recipeId);
  useIngredientIcons(scaledIngredients.map((item) => item.ingredientId));

  const hasInitializedRef = useRef(false);
  const knownIngredientIdsRef = useRef<Set<string>>(new Set());
  // Which lines the Pantry held when the ticks were last settled, so a line
  // that crosses between the sections can be told from one that has not.
  const knownInPantryIdsRef = useRef<Set<string>>(new Set());
  const { addPantryIngredient } = usePantryMutations();
  const onTheList = useOnTheList(pantry.items);
  const pantryLoading = pantry.isLoading;
  const pantryUnavailable = pantry.isUnavailable;

  /**
   * "We keep this": the line's own food goes in the Pantry, or the food of
   * the name as edited here, resolved as a typed name is. The Pantry's
   * optimistic row moves the line under "In your pantry" at once, and the
   * line takes that section's default: unticked.
   */
  const keepLine = (item: GroceryIngredient) => {
    const edited = editedIngredients[item.id]?.name;

    void addPantryIngredient(
      edited !== undefined || !item.ingredientId
        ? (edited ?? item.ingredientName)
        : { ingredientId: item.ingredientId, name: item.ingredientName }
    );
  };

  useEffect(() => {
    // Selection starts from what is to buy, so the Pantry has to have
    // answered before the first pick: a line in the Pantry is never
    // pre-ticked. A Pantry that cannot be read has not answered either, so
    // nothing is ticked: the person ticks what they need, and is told why.
    if (pantryLoading || pantryUnavailable) return;
    const currentIds = scaledIngredients.map((i) => i.id).filter(Boolean);
    const toBuyIds = new Set(toBuy.map((item) => item.id));
    const inPantryIds = new Set(inPantry.map((item) => item.id));

    if (currentIds.length > 0 && !hasInitializedRef.current) {
      knownIngredientIdsRef.current = new Set(currentIds);
      knownInPantryIdsRef.current = inPantryIds;
      setSelectedIds(currentIds.filter((id) => toBuyIds.has(id)));
      hasInitializedRef.current = true;

      return;
    }

    /* A line takes its section's default the moment it joins one: a new line,
       and a line that crossed because a housemate changed the Pantry or
       because its name was edited here. A tick was only ever about the
       section the line was in, so it does not travel with it — otherwise a
       line the Pantry has just claimed would be bought anyway, pre-ticked by
       a default that was about buying it. */
    const isNew = (id: string) => !knownIngredientIdsRef.current.has(id);
    const wasInPantry = (id: string) => knownInPantryIdsRef.current.has(id);
    const tick = currentIds.filter((id) => toBuyIds.has(id) && (isNew(id) || wasInPantry(id)));
    const untick = currentIds.filter((id) => inPantryIds.has(id) && !isNew(id) && !wasInPantry(id));

    knownIngredientIdsRef.current = new Set(currentIds);
    knownInPantryIdsRef.current = inPantryIds;

    if (tick.length === 0 && untick.length === 0) return;

    setSelectedIds((prev) => {
      const next = new Set(prev);

      for (const id of tick) next.add(id);
      for (const id of untick) next.delete(id);

      return Array.from(next);
    });
  }, [scaledIngredients, toBuy, inPantry, pantryLoading, pantryUnavailable]);
  /* Count the visible rows that are selected rather than `selectedIds.length`,
     so an id left behind by an ingredient that has since disappeared cannot
     make the list look fully selected. The count, and "select all", are about
     what is to buy; a line in the Pantry is ticked on its own. */
  const selectedCount = toBuy.filter((item) => selectedIds.includes(item.id)).length;
  const inPantrySelectedCount = inPantry.filter((item) => selectedIds.includes(item.id)).length;
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  /**
   * One section's select-all: every line ticked, or none once every line
   * already is. Each section answers for its own lines and leaves the other
   * section's ticks exactly as they were, which is why the other section's
   * selection is carried across rather than recomputed.
   */
  const toggleSection = (section: GroceryIngredient[], other: GroceryIngredient[]) => {
    const allOfSectionSelected = section.every((item) => selectedIds.includes(item.id));
    const otherSelected = other.map((item) => item.id).filter((id) => selectedIds.includes(id));

    setSelectedIds(
      allOfSectionSelected ? otherSelected : [...otherSelected, ...section.map((item) => item.id)]
    );
  };
  const handleEditStart = (id: string) => {
    const item = scaledIngredients.find((i) => i.id === id);

    if (!item) return;
    setEditingId(item.id);
    const edited = editedIngredients[item.id];

    setEditValue(
      edited
        ? [edited.amount, edited.unit, edited.name].filter(Boolean).join(" ")
        : formatEditableIngredient(item)
    );
  };
  const handleEditSubmit = () => {
    if (editingId) {
      const item = scaledIngredients.find((ingredient) => ingredient.id === editingId);

      if (item) {
        setEditedIngredients((prev) => ({
          ...prev,
          [editingId]: parseEditedIngredientLine(editValue, item),
        }));
      }
    }
    setEditingId(null);
  };
  const handleConfirm = () => {
    void addLines(scaledIngredients.filter((g) => selectedIds.includes(g.id))).then(
      (added) => added && onOpenChange(false)
    );
  };

  /**
   * One ingredient line, to buy or in the Pantry alike, drawn as a row of the
   * groceries page: the tick first, the food's icon, then the amount and the
   * name on one line. A line to buy can be kept from here; a kept line whose
   * food is already on the list says so, so it is not bought twice.
   */
  const renderRow = (item: GroceryIngredient) => {
    const isEditing = editingId === item.id;
    const kept = keptFor(item);
    const edited = editedIngredients[item.id];
    const amountDisplay = formatAmountUnit(
      edited?.amount ?? item.amount,
      edited?.unit ?? item.unit
    );

    return (
      <div
        key={item.id}
        className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-3"
        role="button"
        tabIndex={0}
        onClick={(e) => !isEditing && !isCheckboxEvent(e) && handleEditStart(item.id)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isEditing && !isCheckboxEvent(e)) {
            e.preventDefault();
            handleEditStart(item.id);
          }
        }}
      >
        <RoundCheckbox
          aria-label={item.ingredientName}
          isSelected={selectedIds.includes(item.id)}
          size="lg"
          onChange={() => toggleSelect(item.id)}
        />
        {/* As on the list, decoration a phone's row has no room for; a line
            edited here is only text, so it shows no food's icon. */}
        <IngredientIcon
          className="max-sm:hidden"
          ingredientId={edited ? null : item.ingredientId}
        />
        {isEditing ? (
          <Input
            className="min-w-0 flex-1 text-base"
            style={{
              fontSize: "16px",
            }}
            value={editValue}
            onBlur={handleEditSubmit}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEditSubmit();
              if (e.key === "Escape") setEditingId(null);
            }}
          />
        ) : (
          <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5">
            {amountDisplay && (
              <span className="text-accent shrink-0 font-medium">{amountDisplay}</span>
            )}
            <span className="text-foreground min-w-0 text-base break-words">
              {edited?.name ?? item.ingredientName}
            </span>
          </span>
        )}
        {/* A press here is its own (React Aria stops it reaching the row). */}
        {kept === null ? (
          <IconActionButton
            action="add"
            className="shrink-0"
            icon={ArchiveBoxArrowDownIcon}
            label={t("weKeepThis")}
            size="sm"
            variant="tertiary"
            onPress={() => keepLine(item)}
          />
        ) : onTheList.includes(kept.id) ? (
          <OnTheListMark />
        ) : null}
      </div>
    );
  };

  /**
   * One section of the panel, drawn as a Store's card on the groceries page:
   * a heading bar with its name and how many of its lines are ticked, and
   * select-all where the Store's kebab would be, then its rows.
   */
  const renderSection = (
    section: GroceryIngredient[],
    other: GroceryIngredient[],
    {
      name,
      selected,
      testId,
      toggleTestId,
    }: { name: string; selected: number; testId: string; toggleTestId: string }
  ) => (
    <div
      className="border-border bg-surface shadow-surface shrink-0 overflow-hidden rounded-xl border"
      data-testid={testId}
    >
      <div className="bg-surface-secondary flex items-center gap-2.5 py-2.5 pr-3 pl-4">
        <span className="shrink-0 font-semibold">{name}</span>
        <span className="text-muted min-w-0 truncate text-sm tabular-nums">
          {t("selectedCount", { selected, total: section.length })}
        </span>
        <Button
          className="ml-auto shrink-0"
          data-testid={toggleTestId}
          size="sm"
          variant="tertiary"
          onPress={() => toggleSection(section, other)}
        >
          {selected === section.length ? tActions("deselectAll") : tActions("selectAll")}
        </Button>
      </div>
      <div className="divide-border divide-y">{section.map(renderRow)}</div>
    </div>
  );

  return (
    <>
      <Panel.Body className="flex min-h-0 flex-1 flex-col">
        {isLoading ? (
          <div className="text-muted p-4 text-base">{t("loadingIngredients")}</div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Servings Control */}
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-foreground text-sm font-medium">{t("servings")}</span>
              <div className="inline-flex items-center gap-2">
                <IconActionButton
                  action="decrease"
                  className="bg-surface-secondary"
                  label={tDetail("decreaseServings")}
                  size="sm"
                  tooltipPlacement="bottom"
                  onPress={decrementServings}
                />
                <span className="min-w-8 text-center text-sm font-semibold">
                  {formatServings(servings)}
                </span>
                <IconActionButton
                  action="increase"
                  className="bg-surface-secondary"
                  label={tDetail("increaseServings")}
                  size="sm"
                  tooltipPlacement="bottom"
                  onPress={incrementServings}
                />
              </div>
            </div>

            {pantryUnavailable && (
              <p className="text-muted mb-2 px-1 text-xs" data-testid="pantry-unavailable">
                {t("pantryUnavailable")}
              </p>
            )}

            {scaledIngredients.length === 0 ? (
              <div className="text-muted flex flex-1 items-center justify-center text-base">
                {t("noIngredients")}
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-1">
                {toBuy.length > 0 &&
                  renderSection(toBuy, inPantry, {
                    name: t("toBuy"),
                    selected: selectedCount,
                    testId: "to-buy-section",
                    toggleTestId: "toggle-all",
                  })}
                {inPantry.length > 0 &&
                  renderSection(inPantry, toBuy, {
                    name: t("inPantry"),
                    selected: inPantrySelectedCount,
                    testId: "pantry-section",
                    toggleTestId: "toggle-all-pantry",
                  })}
              </div>
            )}
          </div>
        )}
      </Panel.Body>

      {!isLoading && scaledIngredients.length > 0 && (
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton
              action="add"
              isDisabled={selectedCount + inPantrySelectedCount === 0}
              onPress={handleConfirm}
            >
              {tActions("add")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>
      )}
    </>
  );
}

export default function MiniGroceries({
  open,
  recipeId,
  onOpenChange,
  initialServings = 1,
  originalServings = 1,
  addAtOnce = false,
}: MiniGroceriesProps) {
  const t = useTranslations("groceries.panel");
  // Once per mount: a panel opened because the Pantry could not be read does not add again.
  const [atOnce, setAtOnce] = useState(addAtOnce);
  const lines = { recipeId, initialServings, originalServings, onOpenChange };

  return (
    <>
      {atOnce && !open ? <AddAtOnce {...lines} onDone={() => setAtOnce(false)} /> : null}
      <Panel open={open} title={t("addToGroceries")} onOpenChange={onOpenChange}>
        <MiniGroceriesContent key={recipeId} {...lines} />
      </Panel>
    </>
  );
}
