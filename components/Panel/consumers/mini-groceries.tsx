"use client";

import { addToast, Button, Checkbox, Divider, Input } from "@heroui/react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { MinusIcon, PlusIcon } from "@heroicons/react/16/solid";
import { useUnitsQuery } from "@/hooks/config";
import { useRecipeIngredients } from "@/hooks/recipes/use-recipe-ingredients";
import { useGroceriesMutations } from "@/hooks/groceries";
import Panel from "@/components/Panel/Panel";
import { useServingsScaler, formatServings } from "@/hooks/recipes/use-servings-scaler";

type MiniGroceriesProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeId: string;
  initialServings?: number;
  originalServings?: number;
};

function MiniGroceriesContent({
  recipeId,
  onOpenChange,
  initialServings = 1,
  originalServings = 1,
}: {
  recipeId: string;
  onOpenChange: (open: boolean) => void;
  initialServings: number;
  originalServings: number;
}) {
  const { createGroceriesFromData } = useGroceriesMutations();

  const { ingredients: rawIngredients, isLoading } = useRecipeIngredients(recipeId);
  const { units } = useUnitsQuery();

  // Filter out headings and recipe links - memoized to prevent infinite loops
  const ingredients = useMemo(() => {
    return rawIngredients.filter((i) => {
      const name = i.ingredientName?.trim() ?? "";
      // Skip headings, recipe links, and empty names
      return (
        !name.startsWith("#") &&
        !name.includes("(id:") &&
        !name.includes("/recipe:") &&
        name &&
        i.ingredientId
      );
    });
  }, [rawIngredients]);

  const { servings, scaledIngredients, incrementServings, decrementServings } = useServingsScaler(
    ingredients,
    originalServings,
    initialServings
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Update selected IDs when ingredients change
  useEffect(() => {
    if (scaledIngredients.length > 0) {
      setSelectedIds(scaledIngredients.map((i) => i.ingredientId!).filter(Boolean));
    }
  }, [scaledIngredients]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleEditStart = (id: string) => {
    const item = scaledIngredients.find((i) => i.ingredientId === id);
    if (!item) return;
    setEditingId(id);
    const text = [item.amount, item.unit, item.ingredientName].filter(Boolean).join(" ");
    setEditValue(text);
  };

  const handleEditSubmit = () => {
    // For now, we don't support editing since it would require
    // maintaining separate edited state alongside scaled ingredients
    setEditingId(null);
  };

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleConfirm = () => {
    const selectedIngredients = scaledIngredients
      .filter((g) => selectedIds.includes(g.ingredientId!))
      .map((ri) => ({
        name: ri.ingredientName,
        amount: ri.amount ? parseFloat(String(ri.amount)) : null,
        unit: ri.unit ?? null,
        isDone: false,
      }));

    createGroceriesFromData(selectedIngredients)
      .then(() => {
        close();
        addToast({
          severity: "success",
          title: "Ingredients added to grocery list.",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
      })
      .catch(() => {
        addToast({
          severity: "warning",
          title: "Failed to add ingredients to grocery list.",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
      });
  };

  if (isLoading) {
    return <div className="text-default-500 p-4 text-base">Loading ingredients…</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Servings Control */}
      <div className="mb-3 flex items-center justify-between px-2">
        <span className="text-default-700 text-sm font-medium">Servings</span>
        <div className="inline-flex items-center gap-2">
          <Button
            isIconOnly
            aria-label="Decrease servings"
            className="bg-content2"
            size="sm"
            variant="flat"
            onPress={decrementServings}
          >
            <MinusIcon className="h-4 w-4" />
          </Button>
          <span className="min-w-8 text-center text-sm font-semibold">{formatServings(servings)}</span>
          <Button
            isIconOnly
            aria-label="Increase servings"
            className="bg-content2"
            size="sm"
            variant="flat"
            onPress={incrementServings}
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Divider className="bg-default-200/40 mb-2" />

      {scaledIngredients.length === 0 ? (
        <div className="text-default-500 flex flex-1 items-center justify-center text-base">
          No ingredients.
        </div>
      ) : (
        <div className="divide-default-200/40 flex flex-col divide-y overflow-y-auto">
          {scaledIngredients.map((item) => {
            const isEditing = editingId === item.ingredientId;

            return (
              <div
                key={item.ingredientId}
                className="flex cursor-pointer items-start px-2 py-2"
                role="button"
                tabIndex={0}
                onClick={() => !isEditing && handleEditStart(item.ingredientId!)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !isEditing) {
                    e.preventDefault();
                    handleEditStart(item.ingredientId!);
                  }
                }}
              >
                <Checkbox
                  className="mt-[-4px]"
                  isSelected={selectedIds.includes(item.ingredientId!)}
                  radius="sm"
                  onChange={() => toggleSelect(item.ingredientId!)}
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
                        {item.ingredientName}
                      </span>
                      {item.amount && (
                        <span className="text-primary mt-[-3px] text-xs font-medium">
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

      {scaledIngredients.length > 0 && (
        <div className="mt-4">
          <Divider className="bg-default-200/40 my-2" />
          <button
            className="bg-primary text-primary-foreground w-full rounded-md py-2 text-xs font-semibold transition hover:opacity-90"
            onClick={handleConfirm}
          >
            Add selected to groceries
          </button>
        </div>
      )}
    </div>
  );
}

export default function MiniGroceries({ 
  open, 
  onOpenChange, 
  recipeId,
  initialServings = 1,
  originalServings = 1,
}: MiniGroceriesProps) {
  return (
    <Panel open={open} title="Add to Groceries" onOpenChange={onOpenChange}>
      {open && (
        <MiniGroceriesContent 
          recipeId={recipeId} 
          onOpenChange={onOpenChange}
          initialServings={initialServings}
          originalServings={originalServings}
        />
      )}
    </Panel>
  );
}
