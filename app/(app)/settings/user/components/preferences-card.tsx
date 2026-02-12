"use client";

import { useCallback } from "react";
import { Card, CardBody, CardHeader, Switch, Button } from "@heroui/react";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import { useUserSettingsContext } from "../context";
import { useTimersEnabledQuery } from "@/hooks/config";

export default function PreferencesCard() {
  const t = useTranslations("settings.user.preferences");
  const { user, updatePreferences, isUpdatingPreferences } = useUserSettingsContext();
  const { globalEnabled } = useTimersEnabledQuery();

  const timersEnabled = (user?.preferences as any)?.timersEnabled;
  const effective = typeof timersEnabled === "boolean" ? timersEnabled : true;

  const disabled = !globalEnabled;

  const handleToggle = useCallback(
    async (value: boolean) => {
      // If globally disabled, prevent changes
      if (disabled) return;

      await updatePreferences({ timersEnabled: value });
    },
    [updatePreferences, disabled]
  );

  const conversionEnabled = (user?.preferences as any)?.showConversionButton;
  const conversionEffective = typeof conversionEnabled === "boolean" ? conversionEnabled : true;

  const handleConversionToggle = useCallback(
    async (value: boolean) => {
      await updatePreferences({ showConversionButton: value });
    },
    [updatePreferences]
  );

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <AdjustmentsHorizontalIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </CardHeader>
      <CardBody className="gap-4">
        <p className="text-default-500 text-base">{t("description")}</p>

        {globalEnabled && (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-foreground font-medium">{t("timers.title")}</div>
              <div className="text-default-500 text-sm">{t("timers.description")}</div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                isSelected={effective}
                isDisabled={isUpdatingPreferences || disabled}
                onValueChange={(v) => handleToggle(v)}
              />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-foreground font-medium">{t("conversion.title")}</div>
            <div className="text-default-500 text-sm">{t("conversion.description")}</div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              isSelected={conversionEffective}
              isDisabled={isUpdatingPreferences}
              onValueChange={(v) => handleConversionToggle(v)}
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
