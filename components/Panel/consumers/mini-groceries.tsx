"use client";

import { addToast, Checkbox, Divider, Input } from "@heroui/react";
import { useState, useEffect, useCallback } from "react";

import { parseIngredientWithDefaults } from "@/lib/helpers";
import { useUnitsQuery } from "@/hooks/config";
import { useRecipeIngredients } from "@/hooks/recipes/use-recipe-ingredients";
import { useGroceriesMutations } from "@/hooks/groceries";
import Panel from "@/components/Panel/Panel";

type MiniGroceriesProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
};

function MiniGroceriesContent({
  recipeId,
  onOpenChange,
}: {
  recipeId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { createGroceriesFromData } = useGroceriesMutations();

  const { ingredients, isLoading } = useRecipeIngredients(recipeId);
  const { units } = useUnitsQuery();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const [localIngredients, setLocalIngredients] = useState<
    {
      ingredientId: string;
      ingredientName: string;
      amount?: string | null;
      unit?: string | null;
    }[]
  >([]);

  useEffect(() => {
    if (ingredients.length > 0) {
      // Filter out headings and recipe links
      const filteredIngredients = ingredients.filter((i) => {
        const name = i.ingredientName?.trim() ?? "";
        // Skip headings 
        if (name.startsWith("#")) return false;
        // Skip recipe links
        if (name.includes("(id:") || name.includes("/recipe:")) return false;
        // Skip empty ingredient names
        if (!name || !i.ingredientId) return false;
        return true;
      });

      setSelectedIds(filteredIngredients.map((i) => i.ingredientId!).filter(Boolean));
      setLocalIngredients(
        filteredIngredients.map((i) => ({
          ingredientId: i.ingredientId!,
          ingredientName: i.ingredientName,
          amount: i.amount?.toString() ?? null,
          unit: i.unit,
        }))
      );
    }
  }, [ingredients]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleEditStart = (id: string) => {
    const item = localIngredients.find((i) => i.ingredientId === id);

    if (!item) return;
    setEditingId(id);

    const text = [item.amount, item.unit, item.ingredientName].filter(Boolean).join(" ");

    setEditValue(text);
  };

  const handleEditSubmit = (id: string) => {
    try {
      const parsed = parseIngredientWithDefaults(editValue.trim(), units)[0];

      setLocalIngredients((prev) =>
        prev.map((i) =>
          i.ingredientId === id
            ? {
              ...i,
              ingredientName: parsed.description,
              amount: parsed.quantity?.toString() ?? null,
              unit: parsed.unitOfMeasure ?? null,
            }
            : i
        )
      );
    } catch {
      addToast({
        severity: "warning",
        title: "Could not parse ingredient. Keeping original.",
      });
    }

    setEditingId(null);
  };

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleConfirm = () => {
    const selectedIngredients = localIngredients
      .filter((g) => selectedIds.includes(g.ingredientId))
      .map((ri) => ({
        name: ri.ingredientName,
        amount: ri.amount ? parseFloat(ri.amount) : null,
        unit: ri.unit ?? null,
        isDone: false,
      }));

    createGroceriesFromData(selectedIngredients)
      .then(() => {
        close();
        addToast({
          severity: "success",
          title: "Ingredients added to grocery list.",
        });
      })
      .catch(() => {
        addToast({
          severity: "warning",
          title: "Failed to add ingredients to grocery list.",
        });
      });
  };

  if (isLoading) {
    return <div className="text-default-500 p-4 text-sm">Loading ingredients…</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {localIngredients.length === 0 ? (
        <div className="text-default-500 flex flex-1 items-center justify-center text-sm">
          No ingredients.
        </div>
      ) : (
        <div className="divide-default-200/40 flex flex-col divide-y overflow-y-auto">
          {localIngredients.map((item) => {
            const isEditing = editingId === item.ingredientId;

            return (
              <div
                key={item.ingredientId}
                className="flex cursor-pointer items-start px-2 py-2"
                role="button"
                tabIndex={0}
                onClick={() => !isEditing && handleEditStart(item.ingredientId)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isEditing) {
                    e.preventDefault();
                    handleEditStart(item.ingredientId);
                  }
                }}
              >
                <Checkbox
                  className="mt-[-4px]"
                  isSelected={selectedIds.includes(item.ingredientId)}
                  radius="sm"
                  onChange={() => toggleSelect(item.ingredientId)}
                />
                <div className="ml-2 flex min-w-0 flex-1 flex-col">
                  {isEditing ? (
                    <Input
                      classNames={{
                        input: "text-base",
                      }}
                      size="sm"
                      style={{ fontSize: "16px" }}
                      value={editValue}
                      variant="underlined"
                      onBlur={() => handleEditSubmit(item.ingredientId)}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEditSubmit(item.ingredientId);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                  ) : (
                    <>
                      <span className="truncate text-base font-semibold">
                        {item.ingredientName}
                      </span>
                      {item.amount && (
                        <span className="text-primary mt-[-3px] text-sm font-medium">
                          {item.amount} {item.unit ?? ""}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {localIngredients.length > 0 && (
        <div className="mt-4">
          <Divider className="bg-default-200/40 my-2" />
          <button
            className="bg-primary text-primary-foreground w-full rounded-md py-2 text-sm font-semibold transition hover:opacity-90"
            onClick={handleConfirm}
          >
            Add selected to groceries
          </button>
        </div>
      )}
    </div>
  );
}

export default function MiniGroceries({ open, onOpenChange, recipeId }: MiniGroceriesProps) {
  return (
    <Panel open={open} title="Add to Groceries" onOpenChange={onOpenChange}>
      {open && <MiniGroceriesContent recipeId={recipeId} onOpenChange={onOpenChange} />}
    </Panel>
  );
}
