"use client";

import type { KeyboardEvent } from "react";
import { useState } from "react";
import Panel from "@/components/Panel/Panel";
import { AnimatedNumber } from "@/components/recipes/animated-number";
import { MinusIcon, PlusIcon } from "@heroicons/react/16/solid";
import {
  Button,
  Input,
  InputGroup,
  Label,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import { formatAmountAsDecimal } from "@norish/shared/lib/format-amount";

import { useRecipeContextRequired } from "../context";

type ServingsControlProps = {
  compact?: boolean;
  /** Tapping the figure opens the servings panel; cooking mode's modal sits above panels. */
  withPanel?: boolean;
};

const MIN_SERVINGS = 0.125;
/** The quick picks, as multiples of the servings the recipe was written for. */
const MULTIPLIERS = [0.5, 1, 2, 3, 4];

/**
 * Servings, as the same stepper the Nutrition card uses for portions: the two
 * do the same job on the same page, and drawing them differently says they do
 * not. It sits inline with the Ingredients heading rather than as a row of its
 * own, so the card starts with the list.
 */
export default function ServingsControl({
  compact = false,
  withPanel = true,
}: ServingsControlProps) {
  const { currentServings, recipe, setIngredientAmounts } = useRecipeContextRequired();
  const t = useTranslations("recipes.detail");
  const [panelOpen, setPanelOpen] = useState(false);
  const servings = Math.max(MIN_SERVINGS, currentServings ?? recipe.servings ?? 1);
  const buttonClassName = compact
    ? "bg-surface-secondary size-8 min-w-8 px-0"
    : "bg-surface-secondary";
  const valueClassName = compact
    ? "min-w-6 justify-center text-xs"
    : "min-w-8 justify-center text-sm";

  const dec = () => {
    if (servings <= 1) {
      setIngredientAmounts(Math.max(MIN_SERVINGS, servings / 2));

      return;
    }

    if (servings <= 2) {
      setIngredientAmounts(1);

      return;
    }

    setIngredientAmounts(servings - 1);
  };
  const inc = () => {
    if (servings < 1) {
      setIngredientAmounts(Math.min(1, servings * 2));

      return;
    }

    setIngredientAmounts(servings + 1);
  };

  // Only the figure rolls. Rolling the word beside it would animate something
  // that did not change.
  const figure = (
    <AnimatedNumber className={valueClassName} value={formatAmountAsDecimal(servings)} />
  );

  return (
    <div className={`inline-flex shrink-0 items-center ${compact ? "gap-1" : "gap-2"}`}>
      <Button
        isIconOnly
        aria-label={t("decreaseServings")}
        className={buttonClassName}
        size="sm"
        variant="tertiary"
        onPress={dec}
      >
        <MinusIcon className="h-4 w-4" />
      </Button>

      {withPanel ? (
        <Button
          aria-haspopup="dialog"
          aria-label={t("servingsCount", { count: servings })}
          className={compact ? "h-8 min-w-6 px-1" : "min-w-8 px-1"}
          size="sm"
          variant="ghost"
          onPress={() => setPanelOpen(true)}
        >
          {figure}
        </Button>
      ) : (
        <>
          <span className="sr-only">{t("servingsCount", { count: servings })}</span>
          {figure}
        </>
      )}

      <Button
        isIconOnly
        aria-label={t("increaseServings")}
        className={buttonClassName}
        size="sm"
        variant="tertiary"
        onPress={inc}
      >
        <PlusIcon className="h-4 w-4" />
      </Button>

      {withPanel && (
        <ServingsPanel
          open={panelOpen}
          original={recipe.servings || 1}
          servings={servings}
          onChange={setIngredientAmounts}
          onOpenChange={setPanelOpen}
        />
      )}
    </div>
  );
}

/** Any number of servings or any multiple of the recipe's own, or a common multiple in one tap. */
function ServingsPanel({
  open,
  onOpenChange,
  original,
  servings,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  original: number;
  servings: number;
  onChange: (servings: number) => void;
}) {
  const t = useTranslations("recipes.form");
  const tDetail = useTranslations("recipes.detail");
  const picked = MULTIPLIERS.find((multiplier) => original * multiplier === servings);
  // The typed text, applied as it is typed: closing the panel commits nothing.
  // Typing in one field rewrites the other, so both always say the same.
  const [draft, setDraft] = useState({ servings: "", multiplier: "" });
  const [wasOpen, setWasOpen] = useState(false);
  const drafts = (next: number) => ({
    servings: formatAmountAsDecimal(next),
    multiplier: formatAmountAsDecimal(next / original),
  });

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(drafts(servings));
  }

  const type = (field: "servings" | "multiplier", text: string) => {
    const typed = Number(text.replace(",", "."));
    const next = field === "servings" ? typed : original * typed;
    const valid = next >= MIN_SERVINGS;

    setDraft({ ...(valid ? drafts(next) : draft), [field]: text });
    if (valid) onChange(next);
  };
  const closeOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onOpenChange(false);
  };

  return (
    <Panel open={open} title={t("servings")} onOpenChange={onOpenChange}>
      <Panel.Body className="gap-4 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <TextField value={draft.servings} onChange={(text) => type("servings", text)}>
            <Label>{t("servings")}</Label>
            <Input
              className="h-12 text-center text-base"
              inputMode="decimal"
              variant="secondary"
              onKeyDown={closeOnEnter}
            />
          </TextField>
          <TextField value={draft.multiplier} onChange={(text) => type("multiplier", text)}>
            <Label>{tDetail("multiplier")}</Label>
            <InputGroup className="h-12" variant="secondary">
              <InputGroup.Input
                className="min-w-0 text-center text-base"
                inputMode="decimal"
                onKeyDown={closeOnEnter}
              />
              <InputGroup.Suffix>×</InputGroup.Suffix>
            </InputGroup>
          </TextField>
        </div>

        {/* A pick is the whole answer, so it closes the panel; tapping the
            current one deselects it, which changes nothing. */}
        <ToggleButtonGroup
          fullWidth
          aria-label={t("servings")}
          selectedKeys={picked === undefined ? [] : [String(picked)]}
          selectionMode="single"
          onSelectionChange={(keys) => {
            const [key] = keys;

            if (key !== undefined) onChange(original * Number(key));
            onOpenChange(false);
          }}
        >
          {MULTIPLIERS.map((multiplier) => (
            <ToggleButton key={multiplier} id={String(multiplier)}>
              {multiplier === 0.5 ? "½×" : `${multiplier}×`}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Panel.Body>
    </Panel>
  );
}
