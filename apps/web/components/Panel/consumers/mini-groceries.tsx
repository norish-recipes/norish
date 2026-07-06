"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Panel from "@/components/Panel/Panel";
import {
  ActionButton,
  ActionButtonGroup,
  IconActionButton,
} from "@/components/shared/action-button";
import { useGroceriesMutations } from "@/hooks/groceries";
import {
  useLinkedRecipeIngredients,
  useRecipeIngredients,
} from "@/hooks/recipes/use-recipe-ingredients";
import { Checkbox, Input, Separator, toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { formatServings, useServingsScaler } from "@norish/shared-react/hooks";

type MiniGroceriesProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  initialServings?: number;
  originalServings?: number;
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

/* React Aria checkboxes drop the onClick prop, so stopPropagation on the
   Checkbox never runs; detect checkbox events by containment instead. */
function isCheckboxEvent(event: React.SyntheticEvent) {
  return event.target instanceof Element && event.target.closest('[data-slot="checkbox"]') !== null;
}

export default function MiniGroceries({
  open,
  recipeId,
  onOpenChange,
  initialServings = 1,
  originalServings = 1,
}: MiniGroceriesProps) {
  const t = useTranslations("groceries.panel");
  const tActions = useTranslations("common.actions");
  const { createGroceriesFromData } = useGroceriesMutations();
  const {
    ingredients: rawIngredients,
    systemUsed,
    isLoading,
  } = useRecipeIngredients(open ? recipeId : null);

  const linkedRecipeIds = useMemo(
    () => extractLinkedRecipeIds(rawIngredients as GroceryIngredient[]),
    [rawIngredients]
  );
  const { ingredients: linkedIngredients } = useLinkedRecipeIngredients(
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

  useEffect(() => {
    hasInitialized.current = false;
    knownIngredientIds.current = new Set();
    setSelectedIds([]);
    setEditingId(null);
    setEditValue("");
    setEditedIngredients({});
  }, [open, recipeId]);

  useEffect(() => {
    const currentIds = scaledIngredients.map((i) => i.id).filter(Boolean);

    if (currentIds.length > 0 && !hasInitialized.current) {
      knownIngredientIds.current = new Set(currentIds);
      setSelectedIds(currentIds);
      hasInitialized.current = true;

      return;
    }

    const newIds = currentIds.filter((id) => !knownIngredientIds.current.has(id));

    if (newIds.length > 0) {
      newIds.forEach((id) => knownIngredientIds.current.add(id));
      setSelectedIds((prev) => Array.from(new Set([...prev, ...newIds])));
    }
  }, [scaledIngredients]);
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
  const handleConfirm = () => {
    const selectedIngredients = scaledIngredients
      .filter((g) => selectedIds.includes(g.id))
      .map((ri) => ({
        name: editedIngredients[ri.id]?.name ?? ri.ingredientName,
        amount:
          editedIngredients[ri.id]?.amount ??
          (ri.amount !== null && ri.amount !== undefined ? Number(ri.amount) : null),
        unit: editedIngredients[ri.id]?.unit ?? ri.unit ?? null,
        isDone: false,
        recipeIngredientId: ri.id,
      }));
    createGroceriesFromData(selectedIngredients)
      .then(() => {
        close();
        toast(t("ingredientsAdded"), {
          variant: "success",
        });
      })
      .catch(() => {
        toast(t("ingredientsFailed"), {
          variant: "warning",
        });
      });
  };
  return (
    <Panel open={open} title={t("addToGroceries")} onOpenChange={onOpenChange}>
      <Panel.Body className="flex min-h-0 flex-1 flex-col">
        {open && isLoading ? (
          <div className="text-muted p-4 text-base">{t("loadingIngredients")}</div>
        ) : open ? (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Servings Control */}
            <div className="mb-3 flex items-center justify-between px-2">
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

            <Separator className="bg-surface-tertiary/40 mb-2" />

            {scaledIngredients.length === 0 ? (
              <div className="text-muted flex flex-1 items-center justify-center text-base">
                {t("noIngredients")}
              </div>
            ) : (
              <div className="divide-border/40 flex min-h-0 flex-1 flex-col divide-y overflow-y-auto">
                {scaledIngredients.map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="flex cursor-pointer items-start px-2 py-2"
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
                      <Checkbox
                        aria-label={item.ingredientName}
                        className="mt-[-4px] [&_[data-slot='checkbox-default-indicator--checkmark']]:size-3"
                        isSelected={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                      >
                        <Checkbox.Control className="data-[selected=true]:border-accent data-[selected=true]:bg-accent size-5 rounded-full before:rounded-full">
                          <Checkbox.Indicator className="text-accent-foreground" />
                        </Checkbox.Control>
                      </Checkbox>
                      <div className="ml-2 flex min-w-0 flex-1 flex-col">
                        {isEditing ? (
                          <Input
                            className="text-base"
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
                          <>
                            <span className="truncate text-base font-semibold">
                              {editedIngredients[item.id]?.name ?? item.ingredientName}
                            </span>
                            {(editedIngredients[item.id]?.amount ?? item.amount) ? (
                              <span className="text-accent mt-[-3px] text-xs font-medium">
                                {editedIngredients[item.id]?.amount ?? item.amount}{" "}
                                {editedIngredients[item.id]?.unit ?? item.unit ?? ""}
                              </span>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </Panel.Body>

      {open && !isLoading && scaledIngredients.length > 0 && (
        <Panel.Footer>
          <ActionButtonGroup>
            <ActionButton action="add" onPress={handleConfirm}>
              {tActions("add")}
            </ActionButton>
          </ActionButtonGroup>
        </Panel.Footer>
      )}
    </Panel>
  );
}
