"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GroceryCheckbox, isCheckboxEvent } from "@/components/groceries/grocery-checkbox";
import { OnTheListMark } from "@/components/groceries/pantry/put-on-the-list";
import { IngredientIcon, IngredientIconsProvider } from "@/components/ingredients/ingredient-icon";
import Panel from "@/components/Panel/Panel";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { useSpellingRules } from "@/hooks/config";
import { useGroceriesMutations, useGroceriesQuery } from "@/hooks/groceries";
import { usePantryMutations, usePantryQuery } from "@/hooks/pantry";
import {
  useLinkedRecipeIngredients,
  useRecipeIngredients,
} from "@/hooks/recipes/use-recipe-ingredients";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";
import { ArchiveBoxArrowDownIcon } from "@heroicons/react/16/solid";
import { Button, Input, toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { formatServings, useServingsScaler } from "@norish/shared-react/hooks";
import { groceryOnTheList, pantryIngredientFor } from "@norish/shared/lib/pantry";

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

type GroceryIngredient = {
  id: string;
  ingredientId?: string | null;
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

    for (const match of name.matchAll(/\[[^\]]+\]\(id:([a-zA-Z0-9-]+)\)/g)) {
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

export default function MiniGroceries({
  open,
  recipeId,
  onOpenChange,
  initialServings = 1,
  originalServings = 1,
  addAtOnce = false,
}: MiniGroceriesProps) {
  const t = useTranslations("groceries.panel");
  const tActions = useTranslations("common.actions");
  const { createGroceriesFromData } = useGroceriesMutations();
  const { formatAmountUnit } = useUnitFormatter();
  const {
    ingredients: rawIngredients,
    systemUsed,
    isLoading,
  } = useRecipeIngredients(open || addAtOnce ? recipeId : null);

  const linkedRecipeIds = useMemo(
    () => extractLinkedRecipeIds(rawIngredients as GroceryIngredient[]),
    [rawIngredients]
  );
  const { ingredients: linkedIngredients, isLoading: linkedLoading } = useLinkedRecipeIngredients(
    linkedRecipeIds,
    systemUsed
  );

  const ingredients = useMemo(
    () =>
      [
        ...(rawIngredients as GroceryIngredient[]),
        ...(linkedIngredients as GroceryIngredient[]),
      ].filter(isGroceryIngredient),
    [rawIngredients, linkedIngredients]
  );
  const { servings, scaledIngredients, incrementServings, decrementServings } = useServingsScaler(
    ingredients,
    originalServings,
    initialServings
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editedIngredients, setEditedIngredients] = useState<Record<string, EditedIngredient>>({});
  const hasInitialized = useRef(false);
  const knownIngredientIds = useRef<Set<string>>(new Set());
  // Which lines the Pantry held when the ticks were last settled, so a line
  // that crosses between the sections can be told from one that has not.
  const knownInPantryIds = useRef<Set<string>>(new Set());
  // What the household already has: a line whose Ingredient is in the Pantry
  // is shown apart and left off the list unless it is ticked. A line edited
  // here is only text until it is a grocery, so it is matched by its name.
  const {
    items: pantryIngredients,
    isLoading: pantryLoading,
    isUnavailable: pantryUnavailable,
  } = usePantryQuery();
  const rules = useSpellingRules();
  const { addPantryIngredient } = usePantryMutations();
  const { groceries } = useGroceriesQuery();

  /** The Pantry Ingredient that covers a line, as edited here if it was. */
  const keptFor = useCallback(
    (item: GroceryIngredient) => {
      const edited = editedIngredients[item.id]?.name;

      return pantryIngredientFor(
        pantryIngredients,
        edited === undefined ? item : { ingredientName: edited },
        rules
      );
    },
    [pantryIngredients, editedIngredients, rules]
  );
  const isInPantry = useCallback((item: GroceryIngredient) => keptFor(item) !== null, [keptFor]);

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
    ).catch(() => toast(t("keepFailed"), { variant: "danger" }));
  };
  const { toBuy, inPantry } = useMemo(() => {
    const buy: typeof scaledIngredients = [];
    const have: typeof scaledIngredients = [];

    for (const item of scaledIngredients) (isInPantry(item) ? have : buy).push(item);

    return { toBuy: buy, inPantry: have };
  }, [scaledIngredients, isInPantry]);

  useEffect(() => {
    hasInitialized.current = false;
    knownIngredientIds.current = new Set();
    knownInPantryIds.current = new Set();
    setSelectedIds([]);
    setEditingId(null);
    setEditValue("");
    setEditedIngredients({});
  }, [open, recipeId]);

  useEffect(() => {
    // Selection starts from what is to buy, so the Pantry has to have
    // answered before the first pick: a line in the Pantry is never
    // pre-ticked. A Pantry that cannot be read has not answered either, so
    // nothing is ticked: the person ticks what they need, and is told why.
    if (pantryLoading || pantryUnavailable) return;
    const currentIds = scaledIngredients.map((i) => i.id).filter(Boolean);
    const toBuyIds = new Set(toBuy.map((item) => item.id));
    const inPantryIds = new Set(inPantry.map((item) => item.id));

    if (currentIds.length > 0 && !hasInitialized.current) {
      knownIngredientIds.current = new Set(currentIds);
      knownInPantryIds.current = inPantryIds;
      setSelectedIds(currentIds.filter((id) => toBuyIds.has(id)));
      hasInitialized.current = true;

      return;
    }

    /* A line takes its section's default the moment it joins one: a new line,
       and a line that crossed because a housemate changed the Pantry or
       because its name was edited here. A tick was only ever about the
       section the line was in, so it does not travel with it — otherwise a
       line the Pantry has just claimed would be bought anyway, pre-ticked by
       a default that was about buying it. */
    const isNew = (id: string) => !knownIngredientIds.current.has(id);
    const wasInPantry = (id: string) => knownInPantryIds.current.has(id);
    const tick = currentIds.filter((id) => toBuyIds.has(id) && (isNew(id) || wasInPantry(id)));
    const untick = currentIds.filter((id) => inPantryIds.has(id) && !isNew(id) && !wasInPantry(id));

    knownIngredientIds.current = new Set(currentIds);
    knownInPantryIds.current = inPantryIds;

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
  const selectedCount = useMemo(
    () => toBuy.filter((item) => selectedIds.includes(item.id)).length,
    [toBuy, selectedIds]
  );
  const inPantrySelectedCount = useMemo(
    () => inPantry.filter((item) => selectedIds.includes(item.id)).length,
    [inPantry, selectedIds]
  );
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
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  /** Puts these lines on the list, as edited here; true once they are on it. */
  const addLines = useCallback(
    (lines: GroceryIngredient[]) =>
      createGroceriesFromData(
        lines.map((ri) => ({
          name: editedIngredients[ri.id]?.name ?? ri.ingredientName,
          amount:
            editedIngredients[ri.id]?.amount ??
            (ri.amount !== null && ri.amount !== undefined ? Number(ri.amount) : null),
          unit: editedIngredients[ri.id]?.unit ?? ri.unit ?? null,
          isDone: false,
          recipeIngredientId: ri.id,
        }))
      )
        .then(() => {
          toast(t("ingredientsAdded"), { variant: "success" });

          return true;
        })
        .catch(() => {
          toast(t("ingredientsFailed"), { variant: "warning" });

          return false;
        }),
    [createGroceriesFromData, editedIngredients, t]
  );
  const handleConfirm = () => {
    void addLines(scaledIngredients.filter((g) => selectedIds.includes(g.id))).then(
      (added) => added && close()
    );
  };

  /* Adding at once takes what the panel would have ticked — every line to
     buy, none the Pantry holds — once the recipe and the Pantry have
     answered. A Pantry that cannot be read ticks nothing, so the panel opens
     instead, to say so and let the person tick. */
  const addedAtOnce = useRef(false);

  useEffect(() => {
    if (!addAtOnce || open || addedAtOnce.current) return;
    if (isLoading || linkedLoading || pantryLoading) return;
    addedAtOnce.current = true;
    if (pantryUnavailable) onOpenChange(true);
    else if (toBuy.length === 0) close();
    else void addLines(toBuy).finally(close);
  }, [
    addAtOnce,
    open,
    isLoading,
    linkedLoading,
    pantryLoading,
    pantryUnavailable,
    toBuy,
    addLines,
    close,
    onOpenChange,
  ]);

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
        <GroceryCheckbox
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
            size="sm"
            style={{
              fontSize: "16px",
            }}
            value={editValue}
            variant="underlined"
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
        ) : groceryOnTheList(groceries, kept, rules) ? (
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
    <Panel open={open} title={t("addToGroceries")} onOpenChange={onOpenChange}>
      <Panel.Body className="flex min-h-0 flex-1 flex-col">
        <IngredientIconsProvider ids={ingredients.map((item) => item.ingredientId)}>
          {open && isLoading ? (
            <div className="text-muted p-4 text-base">{t("loadingIngredients")}</div>
          ) : open ? (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Servings Control */}
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-foreground text-sm font-medium">{t("servings")}</span>
                <div className="inline-flex items-center gap-2">
                  <IconActionButton
                    action="decrease"
                    className="bg-surface-secondary"
                    label="Decrease servings"
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
                    label="Increase servings"
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
          ) : null}
        </IngredientIconsProvider>
      </Panel.Body>

      {open && !isLoading && scaledIngredients.length > 0 && (
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
    </Panel>
  );
}
