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
import { ArrowsRightLeftIcon, SparklesIcon } from "@heroicons/react/20/solid";
import { useTranslations } from "next-intl";

import { useRecipeContextRequired } from "../context";

import { MeasurementSystem } from "@/types";
import { cssButtonPill, cssAIGradientText, cssAIIconColor } from "@/config/css-tokens";
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
          className="bg-content2 text-foreground capitalize transition-opacity duration-150 data-[hover=true]:opacity-80"
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
      >
        {(item) => (
          <DropdownItem
            key={item.key}
            className="!bg-transparent py-1 data-[focus=true]:!bg-transparent data-[hover=true]:!bg-transparent data-[selected=true]:!bg-transparent"
            textValue={item.label}
          >
            <Button
              className={`w-full justify-start bg-transparent ${cssButtonPill}`}
              radius="full"
              size="md"
              startContent={
                item.requiresAI ? (
                  <SparklesIcon className={`size-4 ${cssAIIconColor}`} />
                ) : (
                  <ArrowsRightLeftIcon className="text-default-400 size-4" />
                )
              }
              variant="light"
              onPress={() => handleConvert(item.key)}
            >
              <span className={`text-sm font-medium ${item.requiresAI ? cssAIGradientText : ""}`}>
                {item.label}
              </span>
            </Button>
          </DropdownItem>
        )}
      </DropdownMenu>
    </Dropdown>
  );
}
