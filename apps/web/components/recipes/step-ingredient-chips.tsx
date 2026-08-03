"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button, Dropdown, Input, Label } from "@heroui/react";
import { useTranslations } from "next-intl";

import { formatAmount } from "@norish/shared/lib/format-amount";
import { deriveStepIngredientAmount, toLineAmount } from "@norish/shared/lib/step-ingredients";

/** A chip as the editor holds it: which line, and how much of it. */
export interface StepIngredientDraft {
  ingredientOrder: number;
  share: number;
}

type LineLike = {
  ingredientName: string;
  order: number;
  amount?: number | string | null;
  unit?: string | null;
};

export interface StepIngredientChipsProps {
  refs: StepIngredientDraft[];
  /** The recipe's ingredient lines in the editor's active system. */
  ingredients: LineLike[];
  onChange: (refs: StepIngredientDraft[]) => void;
  /**
   * Ask for this line's amount as soon as its chip exists — how a mention
   * attach requests the ask from outside. Consumed via onAutoEntryHandled;
   * an amountless line consumes the ask silently.
   */
  autoEntryOrder?: number | null;
  onAutoEntryHandled?: () => void;
  /**
   * An auto-opened ask closed by keyboard (Enter or Escape) — the moment to
   * put focus back into the step's text. Blur closes stay where the person
   * clicked, and entries opened from the chip's own menu never report.
   */
  onEntryKeyboardClose?: () => void;
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

/**
 * A chip using the whole line is the bare name. Partial use of an amounted
 * line reads as the derived amount ("2.5 g salt") — the same number readers
 * see beneath the step; only an amountless line falls back to the fraction.
 */
function chipLabel(line: LineLike, share: number): string {
  if (Math.abs(share - 1) < 0.0001) return line.ingredientName;

  const lineAmount = toLineAmount(line.amount);

  if (lineAmount == null) return `${formatAmount(share, "fraction")} × ${line.ingredientName}`;

  const derived = deriveStepIngredientAmount(lineAmount, share);

  return [formatAmount(derived, "decimal"), line.unit ?? "", line.ingredientName]
    .filter(Boolean)
    .join(" ");
}

/**
 * The chips row beneath a step in the editor: every ingredient line the step
 * uses, each removable with a tap and carrying an editable use of its line.
 * A line with an amount is edited in amounts — "3" of the 5 eggs — and the
 * entry is stored as the equivalent share, so display stays derived from the
 * live line; a line without one is edited as a fractional share directly.
 * The picker attaches any of the recipe's lines without naming it in the
 * text — that is how "add the spices" carries its three links. Heading rows
 * are not on offer: they are never Step Ingredients.
 */
export function StepIngredientChips({
  refs,
  ingredients,
  onChange,
  autoEntryOrder,
  onAutoEntryHandled,
  onEntryKeyboardClose,
}: StepIngredientChipsProps) {
  const t = useTranslations("recipes.stepIngredients");
  const [customIndex, setCustomIndex] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState("");
  // A line whose chip should open its ask as soon as it exists — set by the
  // picker on attach, or fed in from the mention gesture via autoEntryOrder.
  const [pendingEntryOrder, setPendingEntryOrder] = useState<number | null>(null);
  const customInputRef = useRef<HTMLInputElement | null>(null);
  // What the input opened with: leaving it untouched must change nothing, so
  // a rounded amount prefill cannot drift the stored share on a mere blur.
  const customOpenedWithRef = useRef("");
  // Whether the open entry was an automatic ask (attach) rather than a
  // deliberate menu choice — only asks hand focus back on keyboard close.
  const autoOpenedRef = useRef(false);
  // Closing hands focus away, which blurs the still-mounted input — and that
  // blur re-enters commit with the stale typed value. One close per open.
  const closingRef = useRef(false);

  // Focus follows the editor's own choice of "Custom…"/"Amount…" — this is
  // not a page-load focus steal, which is what the autoFocus prop rule
  // guards. The prefill is selected whole so typing replaces it.
  useEffect(() => {
    if (customIndex !== null) {
      customInputRef.current?.focus();
      customInputRef.current?.select();
    }
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

  const closeCustom = (viaKeyboard: boolean) => {
    if (closingRef.current) return;
    closingRef.current = true;

    const wasAuto = autoOpenedRef.current;

    autoOpenedRef.current = false;
    setCustomIndex(null);
    setCustomValue("");
    if (wasAuto && viaKeyboard) onEntryKeyboardClose?.();
  };

  // An entry on an amounted line is an amount and becomes the equivalent
  // share here, at commit — the stored form never changes. On an amountless
  // line the entry is the share itself.
  const commitCustom = (index: number, viaKeyboard: boolean) => {
    if (closingRef.current) return;

    const parsed = Number(customValue);
    const line = linesByOrder.get(refs[index]?.ingredientOrder ?? -1);
    const lineAmount = line ? toLineAmount(line.amount) : null;
    const edited = customValue !== customOpenedWithRef.current;

    if (edited && Number.isFinite(parsed) && parsed > 0) {
      setShareAt(index, lineAmount == null ? parsed : parsed / lineAmount);
    }
    closeCustom(viaKeyboard);
  };

  const openCustom = useCallback(
    (index: number) => {
      const ref = refs[index];
      const line = ref ? linesByOrder.get(ref.ingredientOrder) : undefined;
      const lineAmount = line ? toLineAmount(line.amount) : null;
      const derived =
        lineAmount == null
          ? null
          : (deriveStepIngredientAmount(lineAmount, ref?.share ?? 1) ?? lineAmount);
      const openedWith =
        derived == null ? String(ref?.share ?? 1) : String(Math.round(derived * 100) / 100);

      closingRef.current = false;
      setCustomIndex(index);
      setCustomValue(openedWith);
      customOpenedWithRef.current = openedWith;
    },
    [refs, linesByOrder]
  );

  // The mention gesture asks from outside: adopt the order and confirm, so
  // the same ask is never replayed by a later render.
  useEffect(() => {
    if (autoEntryOrder == null) return;
    setPendingEntryOrder(autoEntryOrder);
    onAutoEntryHandled?.();
  }, [autoEntryOrder, onAutoEntryHandled]);

  // Open the ask the moment the attached chip exists. An amountless line has
  // no number to ask for and consumes the ask silently. This is the deciding
  // half of the mention's willAsk prediction in step-input — the two must
  // agree, or a mention would give up focus for an ask that never opens.
  useEffect(() => {
    if (pendingEntryOrder == null) return;

    const index = refs.findIndex((ref) => ref.ingredientOrder === pendingEntryOrder);

    if (index === -1) return;

    setPendingEntryOrder(null);

    const line = linesByOrder.get(pendingEntryOrder);

    if (!line || toLineAmount(line.amount) == null) return;

    autoOpenedRef.current = true;
    openCustom(index);
  }, [pendingEntryOrder, refs, linesByOrder, openCustom]);

  if (refs.length === 0 && available.length === 0) return null;

  return (
    <ul aria-label={t("rowLabel")} className="flex flex-wrap items-center gap-1.5">
      {refs.map((ref, index) => {
        const line = linesByOrder.get(ref.ingredientOrder);

        if (!line) return null;

        const label = chipLabel(line, ref.share);
        const hasAmount = toLineAmount(line.amount) != null;
        const customEntryLabel = t(hasAmount ? "share.amount" : "share.custom");

        return (
          <li
            key={`${ref.ingredientOrder}`}
            className="border-border bg-surface-secondary flex items-center gap-0.5 rounded-full border py-0.5 pr-1 pl-2.5"
          >
            {customIndex === index ? (
              <>
                <Input
                  ref={customInputRef}
                  aria-label={t(hasAmount ? "customAmountLabel" : "customShareLabel")}
                  className="h-6 w-16 text-sm"
                  min="0.01"
                  step="0.05"
                  type="number"
                  value={customValue}
                  onBlur={() => commitCustom(index, false)}
                  onChange={(event) => setCustomValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitCustom(index, true);
                    } else if (event.key === "Escape") {
                      closeCustom(true);
                    }
                  }}
                />
                {hasAmount && line.unit ? (
                  <span className="text-muted text-sm">{line.unit}</span>
                ) : null}
              </>
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
                      textValue={customEntryLabel}
                      onAction={() => {
                        autoOpenedRef.current = false;
                        openCustom(index);
                      }}
                    >
                      <Label>{customEntryLabel}</Label>
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
                    onAction={() => {
                      // Attach at the whole line, then ask how much of it —
                      // the ask opens once the chip exists, and dismissing
                      // it unedited keeps the whole line.
                      onChange([...refs, { ingredientOrder: line.order, share: 1 }]);
                      setPendingEntryOrder(line.order);
                    }}
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
