"use client";

import React, { useMemo } from "react";
import {
  Button,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  DropdownTrigger,
  Spinner,
} from "@heroui/react";
import { ArrowsRightLeftIcon } from "@heroicons/react/20/solid";
import { useTranslations } from "next-intl";

import { useRecipeContextRequired } from "../context";

import AIChip from "@/components/shared/ai-chip";
import { MeasurementSystem } from "@/types";
import { cssMenuItemPill } from "@/config/css-tokens";
import { usePermissionsContext } from "@/context/permissions-context";

type ConversionOption = {
  key: MeasurementSystem;
  label: string;
  requiresAI: boolean;
};

export default function SystemConvertMenu() {
  const { recipe, convertingTo, startConversion } = useRecipeContextRequired();
  const { isAIEnabled } = usePermissionsContext();
  const t = useTranslations("recipes.convert");

  const availableSystems = useMemo(
    () => Array.from(new Set(recipe.recipeIngredients.map((ri) => ri.systemUsed))),
    [recipe.recipeIngredients]
  );

  // Build available conversion options
  const conversionOptions = useMemo(() => {
    const options: ConversionOption[] = [];

    const metricRequiresAI = !availableSystems.includes("metric");
    const usRequiresAI = !availableSystems.includes("us");

    // Add metric option if available (has data) or AI is enabled
    if (!metricRequiresAI || isAIEnabled) {
      options.push({ key: "metric", label: t("toMetric"), requiresAI: metricRequiresAI });
    }

    // Add US option if available (has data) or AI is enabled
    if (!usRequiresAI || isAIEnabled) {
      options.push({ key: "us", label: t("toUS"), requiresAI: usRequiresAI });
    }

    return options;
  }, [availableSystems, isAIEnabled, t]);

  // If no conversion options available, don't show the menu
  if (conversionOptions.length === 0) {
    return null;
  }

  const currentSystem: MeasurementSystem = convertingTo != null ? convertingTo : recipe.systemUsed;

  const handleConvert = async (target: MeasurementSystem) => {
    if (target === currentSystem) return;

    startConversion(target);
  };

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          className="bg-content2 text-foreground capitalize transition-transform duration-200 ease-out hover:scale-[1.02] hover:opacity-95"
          disabled={convertingTo != null}
          size="sm"
          startContent={
            convertingTo != null ? (
              <Spinner className="mr-2" size="sm" />
            ) : (
              <ArrowsRightLeftIcon className="h-4 w-4" />
            )
          }
          variant="flat"
        >
          {currentSystem}
        </Button>
      </DropdownTrigger>

<DropdownMenu
        aria-label={t("ariaLabel")}
        items={conversionOptions}
        selectedKeys={[currentSystem]}
        selectionMode="single"
        onAction={(key) => handleConvert(key as MeasurementSystem)}
      >
        {(item) => (
          <DropdownItem key={item.key} className={`py-2 ${cssMenuItemPill}`} textValue={item.label}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{item.label}</span>
              {item.requiresAI && <AIChip className="ml-auto" />}
            </div>
          </DropdownItem>
        )}
      </DropdownMenu>
    </Dropdown>
  );
}
