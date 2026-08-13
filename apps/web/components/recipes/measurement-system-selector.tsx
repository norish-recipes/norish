"use client";

import React from "react";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useTranslations } from "next-intl";

import { MeasurementSystem } from "@norish/shared/contracts";

export interface MeasurementSystemSelectorProps {
  value: MeasurementSystem;
  onChange: (system: MeasurementSystem) => void;
  detected?: MeasurementSystem;
  className?: string;
}
export default function MeasurementSystemSelector({
  value,
  onChange,
  detected,
  className = "",
}: MeasurementSystemSelectorProps) {
  const t = useTranslations("recipes.measurementSystem");
  const systems: MeasurementSystem[] = ["metric", "us"];
  const systemLabels: Record<MeasurementSystem, string> = {
    metric: t("metric"),
    us: t("us"),
  };
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-foreground text-sm font-medium">{t("label")}</span>
        {detected && detected !== value && (
          <span className="text-muted text-xs">
            {t("detected", {
              system: systemLabels[detected],
            })}
          </span>
        )}
      </div>
      <ToggleButtonGroup
        disallowEmptySelection
        fullWidth
        selectedKeys={[value]}
        selectionMode="single"
        size="md"
        onSelectionChange={(keys) => {
          const [system] = Array.from(keys);

          if (system === "metric" || system === "us") {
            onChange(system);
          }
        }}
      >
        {systems.map((system) => (
          <ToggleButton key={system} className="flex-1" id={system}>
            {system === "us" && <ToggleButtonGroup.Separator />}
            {systemLabels[system]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}
