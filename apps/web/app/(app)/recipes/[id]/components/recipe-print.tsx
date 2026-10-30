"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import RecipePrintCard from "@/components/recipes/recipe-print-card";
import { useTimerKeywordsQuery, useTimersEnabledQuery } from "@/hooks/config";
import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";
import { useUnitFormatter } from "@/hooks/use-unit-formatter";
import { Button, Checkbox, Label, ListBox, Modal, Select } from "@heroui/react";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";

import { useHydrated } from "@norish/shared-react/hooks";
import { primaryRecipeImage } from "@norish/shared/lib/recipe-media";

import { useRecipeContextRequired } from "../context";

import "@/styles/recipe-print.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function RecipePrint({ open, onOpenChange }: Props) {
  const { recipe, adjustedIngredients, currentServings } = useRecipeContextRequired();
  const { mode } = useAmountDisplayPreference();
  const { formatUnitOnly } = useUnitFormatter();
  const { timersEnabled } = useTimersEnabledQuery();
  const { timerKeywords } = useTimerKeywordsQuery();
  const t = useTranslations("recipes.print");
  const tActions = useTranslations("common.actions");
  const [includePhoto, setIncludePhoto] = useState(true);
  const [textSize, setTextSize] = useState(12);
  // The print copy is portalled into document.body, which only the browser has.
  const hydrated = useHydrated();

  if (!hydrated) return null;

  const card = (
    <RecipePrintCard
      amountMode={mode}
      formatUnitOnly={formatUnitOnly}
      includePhoto={includePhoto}
      ingredients={adjustedIngredients}
      recipe={recipe}
      servings={recipe.servings == null ? null : currentServings}
      timerConfig={{
        enabled: timersEnabled && timerKeywords.enabled,
        keywords: timerKeywords,
        recipeId: recipe.id,
        stepIndex: 0,
      }}
    />
  );

  return (
    <>
      <Modal.Backdrop className="z-[1099]" isOpen={open} onOpenChange={onOpenChange}>
        <Modal.Container className="z-[1100]" size="full">
          <Modal.Dialog
            aria-label={t("title")}
            className="recipe-print-dialog"
            style={{ "--recipe-print-size": `${textSize}pt` } as CSSProperties}
          >
            <Modal.Header className="recipe-print-toolbar">
              <Modal.Heading>{t("title")}</Modal.Heading>
              {primaryRecipeImage(recipe) && (
                <Checkbox isSelected={includePhoto} onChange={setIncludePhoto}>
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Label>{t("includePhoto")}</Label>
                  </Checkbox.Content>
                </Checkbox>
              )}
              <Select
                aria-label={t("textSize")}
                className="w-auto flex-row items-center gap-2"
                value={String(textSize)}
                onChange={(selected) => {
                  if (typeof selected === "string") setTextSize(Number(selected));
                }}
              >
                <Label className="whitespace-nowrap">{t("textSize")}</Label>
                <Select.Trigger className="w-32">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {[11, 12, 13].map((size) => (
                      <ListBox.Item key={size} id={String(size)} textValue={`${size} pt`}>
                        {size} pt
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <Button onPress={() => window.print()}>{t("print")}</Button>
              <Button variant="tertiary" onPress={() => onOpenChange(false)}>
                {tActions("close")}
              </Button>
            </Modal.Header>
            {card}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      {createPortal(
        <div data-recipe-print style={{ "--recipe-print-size": `${textSize}pt` } as CSSProperties}>
          <style>{`@media print {
            @page recipe { @top-left { content: ${JSON.stringify(`${recipe.name} (${t("continued")})`)}; } }
            @page recipe:first { @top-left { content: none; } }
          }`}</style>
          {/* Fixed modal overlays do not paginate like normal document flow. */}
          <div className="recipe-print-document">{card}</div>
        </div>,
        document.body
      )}
    </>
  );
}
