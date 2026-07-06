"use client";

import { ArrowsRightLeftIcon } from "@heroicons/react/16/solid";
import { Button, Dropdown, Label } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { MeasurementSystem } from "@norish/shared/contracts";

export function ShareSystemSwitcher({
  availableSystems,
  activeSystem,
  onChange,
}: {
  availableSystems: MeasurementSystem[];
  activeSystem: MeasurementSystem;
  onChange: (system: MeasurementSystem) => void;
}) {
  const t = useTranslations("recipes.convert");

  if (availableSystems.length <= 1) return null;

  return (
    <Dropdown>
      <Button
        className="bg-surface-secondary text-foreground min-w-16 capitalize transition-opacity duration-150 data-[hovered=true]:opacity-80"
        size="sm"
        variant="tertiary"
      >
        <ArrowsRightLeftIcon className="h-4 w-4" />
        {activeSystem}
      </Button>

      <Dropdown.Popover className="bg-overlay">
        <Dropdown.Menu aria-label={t("ariaLabel")}>
          {availableSystems.map((system) => (
            <Dropdown.Item
              key={system}
              className="capitalize"
              id={system}
              textValue={system === "metric" ? t("toMetric") : t("toUS")}
              onPress={() => {
                if (system !== activeSystem) onChange(system);
              }}
            >
              {system === activeSystem ? <Dropdown.ItemIndicator /> : null}
              <Label>{system === "metric" ? t("toMetric") : t("toUS")}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
