"use client";

import { useState } from "react";
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
import { Button, Input } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { ScaledFood } from "@norish/shared-react/groceries";
import type { EditedIngredient } from "@norish/shared/lib/grocery-lines";
import {
  useAddAtOnce,
  useGroceriesPantryAndCatalogueSubscriptions,
  useGroceryLines,
} from "@norish/shared-react/groceries";
import { useIngredientIcons } from "@norish/shared-react/ingredients";
import {
  formatServings,
  useRecipeFoodsToBuy,
  useRecipeSubscription,
} from "@norish/shared-react/recipes";
import {
  formatEditableIngredient,
  parseEditedIngredientLine,
} from "@norish/shared/lib/grocery-lines";

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

type LinesProps = {
  recipeId: string;
  initialServings: number;
  originalServings: number;
  onOpenChange: (open: boolean) => void;
};

/* Adds what the panel would have ticked, unseen; see useAddAtOnce. */
function AddAtOnce({
  recipeId,
  initialServings,
  originalServings,
  onOpenChange,
  onDone,
}: LinesProps & { onDone: () => void }) {
  const { scaledIngredients, isLoading } = useRecipeFoodsToBuy(
    recipeId,
    originalServings,
    initialServings
  );

  useAddAtOnce({
    lines: scaledIngredients,
    linesReady: !isLoading,
    onOpenChange,
    onDone,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editedIngredients, setEditedIngredients] = useState<Record<string, EditedIngredient>>({});
  const { isLoading, servings, scaledIngredients, incrementServings, decrementServings } =
    useRecipeFoodsToBuy(recipeId, originalServings, initialServings);
  const {
    pantry,
    toBuy,
    inPantry,
    addTicked,
    isAdding,
    selectedCount,
    inPantrySelectedCount,
    controls,
  } = useGroceryLines(scaledIngredients, editedIngredients);

  useGroceriesPantryAndCatalogueSubscriptions();
  useRecipeSubscription(recipeId);
  useIngredientIcons(scaledIngredients.map((item) => item.ingredientId));

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
    void addTicked().then((added) => added && onOpenChange(false));
  };

  /**
   * One ingredient line, to buy or in the Pantry alike, drawn as a row of the
   * groceries page: the tick first, the food's icon, then the amount and the
   * name on one line. A line to buy can be kept from here; a kept line whose
   * food is already on the list says so, so it is not bought twice.
   */
  const renderRow = (item: ScaledFood) => {
    const isEditing = editingId === item.id;
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
          isSelected={controls.isSelected(item.id)}
          size="lg"
          onChange={() => controls.toggle(item.id)}
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
        {controls.canKeep(item) ? (
          <IconActionButton
            action="add"
            className="shrink-0"
            icon={ArchiveBoxArrowDownIcon}
            label={t("weKeepThis")}
            size="sm"
            variant="tertiary"
            onPress={() => controls.keep(item)}
          />
        ) : controls.isOnTheList(item) ? (
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
    section: ScaledFood[],
    other: ScaledFood[],
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
          onPress={() => controls.toggleSection(section, other)}
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

            {pantry.isUnavailable && (
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
              isDisabled={selectedCount + inPantrySelectedCount === 0 || isAdding}
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
