"use client";

import React from "react";
import { ArrowsRightLeftIcon, SparklesIcon } from "@heroicons/react/20/solid";
import { Button, Dropdown, Label, Spinner } from "@heroui/react";
import { useTranslations } from "next-intl";

import { cssAIGradientText, cssAIIconColor, cssButtonPill } from "@norish/web/config/css-tokens";

import type { SystemConversionOption } from "./use-system-conversion";
import { useSystemConversion } from "./use-system-conversion";

type SystemConvertMenuProps = {
  compact?: boolean;
};
export default function SystemConvertMenu({ compact = false }: SystemConvertMenuProps) {
  const { isAvailable, options, currentSystem, isConverting, convertTo } = useSystemConversion();
  const t = useTranslations("recipes.convert");

  if (!isAvailable) {
    return null;
  }
  return (
    <Dropdown>
      <Button
        className={`bg-surface-secondary text-foreground capitalize transition-opacity duration-150 data-[hovered=true]:opacity-80 ${
          compact ? "h-8 min-w-14 px-2 text-xs" : "min-w-16"
        }`}
        isDisabled={isConverting}
        size="sm"
        variant="tertiary"
      >
        {isConverting ? (
          <Spinner className="mr-2" size="sm" />
        ) : (
          <ArrowsRightLeftIcon className="h-4 w-4" />
        )}
        {currentSystem}
      </Button>

      <Dropdown.Popover className="bg-overlay z-[1300]">
        <Dropdown.Menu aria-label={t("ariaLabel")} items={options}>
          {(item: SystemConversionOption) => (
            <Dropdown.Item
              id={item.key}
              key={item.key}
              className="!bg-transparent py-1 data-[focus=true]:!bg-transparent data-[hovered=true]:!bg-transparent data-[selected=true]:!bg-transparent"
              textValue={item.label}
              onPress={() => convertTo(item)}
            >
              <div className={`flex w-full items-center justify-start gap-2 ${cssButtonPill}`}>
                {item.withAI ? (
                  <SparklesIcon className={`size-4 ${cssAIIconColor}`} />
                ) : (
                  <ArrowsRightLeftIcon className="text-muted size-4" />
                )}
                <span className={`text-sm font-medium ${item.withAI ? cssAIGradientText : ""}`}>
                  <Label>{item.label}</Label>
                </span>
              </div>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
