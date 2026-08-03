"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button, Dropdown, Input, Label } from "@heroui/react";
import { useTranslations } from "next-intl";

import { formatAmount } from "@norish/shared/lib/format-amount";

/** A chip as the editor holds it: which line, and how much of it. */
export interface StepIngredientDraft {
  ingredientOrder: number;
  share: number;
}

type LineLike = {
  ingredientName: string;
  order: number;
};

export interface StepIngredientChipsProps {
  refs: StepIngredientDraft[];
  /** The recipe's ingredient lines in the editor's active system. */
  ingredients: LineLike[];
  onChange: (refs: StepIngredientDraft[]) => void;
}

const SHARE_PRESETS = [
  { key: "full", value: 1 },
  { key: "half", value: 0.5 },
  { key: "third", value: 1 / 3 },
  { key: "quarter", value: 0.25 },
] as const;

function isHeading(line: LineLike): boolean {
  return line.ingredientName.trim().startsWith("#");
}

function shareLabel(share: number): string | null {
  if (Math.abs(share - 1) < 0.0001) return null;

  return formatAmount(share, "fraction");
}

/**
 * The chips row beneath a step in the editor: every ingredient line the step
 * uses, each removable with a tap and carrying an editable fractional share.
 * The picker attaches any of the recipe's lines without naming it in the
 * text — that is how "add the spices" carries its three links. Heading rows
 * are not on offer: they are never Step Ingredients.
 */
export function StepIngredientChips({ refs, ingredients, onChange }: StepIngredientChipsProps) {
  const t = useTranslations("recipes.stepIngredients");
  const [customIndex, setCustomIndex] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState("");
  const customInputRef = useRef<HTMLInputElement | null>(null);

  // Focus follows the editor's own choice of "Custom…" — this is not a
  // page-load focus steal, which is what the autoFocus prop rule guards.
  useEffect(() => {
    if (customIndex !== null) customInputRef.current?.focus();
  }, [customIndex]);

  const linesByOrder = useMemo(() => {
    const byOrder = new Map<number, LineLike>();

    for (const line of ingredients) {
      if (!isHeading(line) && !byOrder.has(line.order)) byOrder.set(line.order, line);
    }

    return byOrder;
  }, [ingredients]);

  const attached = new Set(refs.map((ref) => ref.ingredientOrder));
  const available = [...linesByOrder.values()].filter((line) => !attached.has(line.order));

  const removeAt = (index: number) => {
    onChange(refs.filter((_, i) => i !== index));
  };

  const setShareAt = (index: number, share: number) => {
    onChange(refs.map((ref, i) => (i === index ? { ...ref, share } : ref)));
  };

  const commitCustom = (index: number) => {
    const parsed = Number(customValue);

    if (Number.isFinite(parsed) && parsed > 0) {
      setShareAt(index, parsed);
    }
    setCustomIndex(null);
    setCustomValue("");
  };

  if (refs.length === 0 && available.length === 0) return null;

  return (
    <ul aria-label={t("rowLabel")} className="flex flex-wrap items-center gap-1.5">
      {refs.map((ref, index) => {
        const line = linesByOrder.get(ref.ingredientOrder);

        if (!line) return null;

        const share = shareLabel(ref.share);
        const label = share ? `${share} × ${line.ingredientName}` : line.ingredientName;

        return (
          <li
            key={`${ref.ingredientOrder}`}
            className="border-border bg-surface-secondary flex items-center gap-0.5 rounded-full border py-0.5 pr-1 pl-2.5"
          >
            {customIndex === index ? (
              <Input
                ref={customInputRef}
                aria-label={t("customShareLabel")}
                className="h-6 w-16 text-sm"
                min="0.01"
                step="0.05"
                type="number"
                value={customValue}
                onBlur={() => commitCustom(index)}
                onChange={(event) => setCustomValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitCustom(index);
                  } else if (event.key === "Escape") {
                    setCustomIndex(null);
                    setCustomValue("");
                  }
                }}
              />
            ) : (
              <Dropdown>
                <Button
                  aria-label={t("shareLabel", { name: line.ingredientName })}
                  className="h-6 min-w-0 bg-transparent px-1 text-sm font-normal"
                  size="sm"
                  variant="tertiary"
                >
                  {label}
                </Button>
                <Dropdown.Popover className="bg-overlay z-[500]">
                  <Dropdown.Menu aria-label={t("shareLabel", { name: line.ingredientName })}>
                    {SHARE_PRESETS.map((preset) => (
                      <Dropdown.Item
                        key={preset.key}
                        id={preset.key}
                        textValue={t(`share.${preset.key}`)}
                        onAction={() => setShareAt(index, preset.value)}
                      >
                        <Label>{t(`share.${preset.key}`)}</Label>
                      </Dropdown.Item>
                    ))}
                    <Dropdown.Item
                      id="custom"
                      textValue={t("share.custom")}
                      onAction={() => {
                        setCustomIndex(index);
                        setCustomValue(String(ref.share));
                      }}
                    >
                      <Label>{t("share.custom")}</Label>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            )}
            <Button
              isIconOnly
              aria-label={t("removeLabel", { name: line.ingredientName })}
              className="h-5 w-5 min-w-0 bg-transparent"
              size="sm"
              variant="tertiary"
              onPress={() => removeAt(index)}
            >
              <XMarkIcon className="text-muted h-3.5 w-3.5" />
            </Button>
          </li>
        );
      })}

      {available.length > 0 && (
        <li>
          <Dropdown>
            <Button
              aria-label={t("addLabel")}
              className="text-muted h-6 min-w-0 rounded-full px-2 text-sm font-normal"
              size="sm"
              variant="tertiary"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {t("addLabel")}
            </Button>
            <Dropdown.Popover className="bg-overlay z-[500]">
              <Dropdown.Menu
                aria-label={t("pickerLabel")}
                className="scrollbar-hide max-h-64 overflow-y-auto"
              >
                {available.map((line) => (
                  <Dropdown.Item
                    key={`${line.order}`}
                    id={`${line.order}`}
                    textValue={line.ingredientName}
                    onAction={() => onChange([...refs, { ingredientOrder: line.order, share: 1 }])}
                  >
                    <Label>{line.ingredientName}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </li>
      )}
    </ul>
  );
}
