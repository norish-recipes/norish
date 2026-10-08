"use client";

import { useState } from "react";
import { useAmountDisplayPreference } from "@/hooks/use-amount-display-preference";
import {
  AdjustmentsHorizontalIcon,
  ArrowsRightLeftIcon,
  CalculatorIcon,
  SparklesIcon,
} from "@heroicons/react/20/solid";
import { Button, Dropdown, Label } from "@heroui/react";
import { useTranslations } from "next-intl";
import { twMerge } from "tailwind-merge";

import { cssAIGradientText, cssAIIconColor, cssButtonPill } from "@norish/web/config/css-tokens";

import { useSystemConversion } from "./use-system-conversion";

type OptionItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  labelClassName?: string;
  iconClassName?: string;
  description?: string;
  isDisabled?: boolean;
};

/**
 * The two things a reader changes about the ingredients themselves: whether
 * amounts read as fractions or decimals, and which measurement system they
 * are in.
 *
 * They live on the Ingredients card rather than in the page's `⋯` menu
 * because that is what they act on — a reader looking at "1½ cups" and
 * wanting "1.5" looks at the list, not at the page. The card header has room
 * for exactly one control beside the title, so both fold into one menu.
 */
export default function IngredientsOptionsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { mode, toggleMode } = useAmountDisplayPreference();
  const conversion = useSystemConversion();
  const t = useTranslations("recipes.detail");
  const tConvert = useTranslations("recipes.convert");

  const items: OptionItem[] = [
    {
      key: "amount-display",
      label: mode === "fraction" ? t("switchToDecimal") : t("switchToFraction"),
      // A solid icon like the two beside it: a text glyph at this size reads
      // as a different weight and never lines up with them.
      icon: <CalculatorIcon className="size-5" />,
      onPress: toggleMode,
    },
  ];

  // The system the recipe is already in is not somewhere to convert to, so
  // only the reachable ones are drawn; with AI it is, since AI writes it again.
  if (conversion.isAvailable) {
    for (const option of conversion.options) {
      if (!option.withAI && option.system === conversion.currentSystem) continue;

      items.push({
        key: `convert-${option.key}`,
        label: option.label,
        icon: option.withAI ? (
          <SparklesIcon className="size-5" />
        ) : (
          <ArrowsRightLeftIcon className="size-5" />
        ),
        onPress: () => conversion.convertTo(option),
        labelClassName: option.withAI ? cssAIGradientText : "",
        iconClassName: option.withAI ? cssAIIconColor : "text-muted",
        description: conversion.isConverting ? tConvert("converting") : undefined,
        isDisabled: conversion.isConverting,
      });
    }
  }

  return (
    <Dropdown isOpen={isOpen} onOpenChange={setIsOpen}>
      {/* Sized exactly as the stepper beside it: three controls in one header
          that are almost the same size read as a mistake. */}
      <Button
        isIconOnly
        aria-label={t("ingredientOptions")}
        className="bg-surface-secondary text-muted"
        size="sm"
        variant="tertiary"
      >
        <AdjustmentsHorizontalIcon className="size-4" />
      </Button>

      <Dropdown.Popover className="bg-overlay z-[500]">
        <Dropdown.Menu aria-label={t("ingredientOptions")} items={items}>
          {(item: OptionItem) => (
            <Dropdown.Item
              id={item.key}
              key={item.key}
              className="py-1 data-[focus=true]:bg-transparent data-[hovered=true]:bg-transparent"
              textValue={item.label}
            >
              <Button
                className={twMerge("w-full justify-start bg-transparent", cssButtonPill)}
                isDisabled={item.isDisabled}
                size="md"
                variant="tertiary"
                onPress={() => {
                  setIsOpen(false);
                  item.onPress();
                }}
              >
                <span className={item.iconClassName ?? "text-muted"}>{item.icon}</span>
                <span className="flex flex-col items-start">
                  <Label className={twMerge("text-sm font-medium", item.labelClassName)}>
                    {item.label}
                  </Label>
                  {item.description && (
                    <span className="text-muted text-xs">{item.description}</span>
                  )}
                </span>
              </Button>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
