"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocaleConfigQuery, useTimersEnabledQuery } from "@/hooks/config";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { Card, CardBody, CardHeader, Select, SelectItem, Switch } from "@heroui/react";
import { useTranslations } from "next-intl";

import {
  getLocalePreference,
  getShowConversionButtonPreference,
  getShowFavoritesPreference,
  getShowRatingsPreference,
  getTimersEnabledPreference,
} from "@norish/shared/lib/user-preferences";

import { useUserSettingsContext } from "../context";

export default function PreferencesCard() {
  const t = useTranslations("settings.user.preferences");
  const { user, updatePreferences, isUpdatingPreferences } = useUserSettingsContext();
  const { globalEnabled } = useTimersEnabledQuery();
  const { enabledLocales, defaultLocale } = useLocaleConfigQuery();
  const router = useRouter();

  const effective = getTimersEnabledPreference(user);

  const disabled = !globalEnabled;

  const currentLocale = getLocalePreference(user) ?? defaultLocale;
  const selectedLocale = enabledLocales.some((locale) => locale.code === currentLocale)
    ? currentLocale
    : undefined;

  const handleToggle = useCallback(
    async (value: boolean) => {
      // If globally disabled, prevent changes
      if (disabled) return;

      await updatePreferences({ timersEnabled: value });
    },
    [updatePreferences, disabled]
  );

  const conversionEffective = getShowConversionButtonPreference(user);
  const ratingsEffective = getShowRatingsPreference(user);
  const favoritesEffective = getShowFavoritesPreference(user);

  const handleConversionToggle = useCallback(
    async (value: boolean) => {
      await updatePreferences({ showConversionButton: value });
    },
    [updatePreferences]
  );

  const handleRatingsToggle = useCallback(
    async (value: boolean) => {
      await updatePreferences({ showRatings: value });
    },
    [updatePreferences]
  );

  const handleFavoritesToggle = useCallback(
    async (value: boolean) => {
      await updatePreferences({ showFavorites: value });
    },
    [updatePreferences]
  );

  const handleLocaleChange = useCallback(
    async (value: string) => {
      if (!value || value === currentLocale) return;

      await updatePreferences({ locale: value });
      router.refresh();
    },
    [updatePreferences, currentLocale, router]
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

        <div className="flex items-center justify-between">
          <div>
            <div className="text-foreground font-medium">{t("language.title")}</div>
            <div className="text-default-500 text-sm">{t("language.description")}</div>
          </div>

          <Select
            aria-label={t("language.title")}
            className="max-w-[200px]"
            isDisabled={isUpdatingPreferences || enabledLocales.length === 0}
            selectedKeys={selectedLocale ? [selectedLocale] : []}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;

              if (selected) handleLocaleChange(selected);
            }}
          >
            {enabledLocales.map((locale) => (
              <SelectItem key={locale.code} id={locale.code}>
                {locale.name}
              </SelectItem>
            ))}
          </Select>
        </div>

        {globalEnabled && (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-foreground font-medium">{t("timers.title")}</div>
              <div className="text-default-500 text-sm">{t("timers.description")}</div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                isDisabled={isUpdatingPreferences || disabled}
                isSelected={effective}
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
              isDisabled={isUpdatingPreferences}
              isSelected={conversionEffective}
              onValueChange={(v) => handleConversionToggle(v)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-foreground font-medium">{t("ratings.title")}</div>
            <div className="text-default-500 text-sm">{t("ratings.description")}</div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              isDisabled={isUpdatingPreferences}
              isSelected={ratingsEffective}
              onValueChange={(v) => handleRatingsToggle(v)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-foreground font-medium">{t("favorites.title")}</div>
            <div className="text-default-500 text-sm">{t("favorites.description")}</div>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              isDisabled={isUpdatingPreferences}
              isSelected={favoritesEffective}
              onValueChange={(v) => handleFavoritesToggle(v)}
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
