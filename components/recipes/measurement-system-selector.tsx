"use client";

import React from "react";
import { Button, ButtonGroup } from "@heroui/react";
import { useTranslations } from "next-intl";

import { MeasurementSystem } from "@/types";

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
        <span className="text-default-700 text-sm font-medium">{t("label")}</span>
        {detected && detected !== value && (
          <span className="text-default-500 text-xs">
            {t("detected", { system: systemLabels[detected] })}
          </span>
        )}
      </div>
      <ButtonGroup className="w-full" size="md">
        {systems.map((system) => (
          <Button
            key={system}
            className="flex-1"
            color={value === system ? "primary" : "default"}
            variant={value === system ? "solid" : "flat"}
            onPress={() => onChange(system)}
          >
            {systemLabels[system]}
          </Button>
        ))}
      </ButtonGroup>
    </div>
  );
}
