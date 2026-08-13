"use client";

import type { TodaySectionVisibility } from "@/lib/todays-meals-visibility";
import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTodaySectionVisibility } from "@/context/todays-meals-visibility-context";
import { useLocaleConfigQuery, useTimersEnabledQuery } from "@/hooks/config";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { Card, Label, ListBox, Select } from "@heroui/react";
import { useTranslations } from "next-intl";

import { HIDDEN_ITEMS } from "@norish/shared/contracts/zod/user";
import { getLocalePreference, partitionHiddenItems } from "@norish/shared/lib/user-preferences";

import { useUserSettingsContext } from "../context";

export default function PreferencesCard() {
  const t = useTranslations("settings.user.preferences");
  const { user, updatePreferences, isUpdatingPreferences } = useUserSettingsContext();
  const { globalEnabled } = useTimersEnabledQuery();
  const { enabledLocales, defaultLocale } = useLocaleConfigQuery();
  const router = useRouter();
  const [todaySectionVisibility, setTodaySectionVisibility] = useTodaySectionVisibility();

  const todaySectionOptions: TodaySectionVisibility[] = ["always", "planned", "hidden"];

  const currentLocale = getLocalePreference(user) ?? defaultLocale;
  const selectedLocale = enabledLocales.some((locale) => locale.code === currentLocale)
    ? currentLocale
    : undefined;

  // Timers are a capability an administrator can switch off for the whole
  // deployment; when they have, there is nothing to offer the reader.
  const offeredHidden = useMemo(
    () => (globalEnabled ? HIDDEN_ITEMS : HIDDEN_ITEMS.filter((item) => item !== "timers")),
    [globalEnabled]
  );

  const { selected: selectedHidden, carried } = partitionHiddenItems(user, offeredHidden);

  const handleHiddenChange = useCallback(
    async (chosen: string[]) => {
      await updatePreferences({ hidden: [...chosen, ...carried] });
    },
    [updatePreferences, carried]
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
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <AdjustmentsHorizontalIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="gap-4">
        <p className="text-muted text-base">{t("description")}</p>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-foreground font-medium">{t("language.title")}</div>
            <div className="text-muted text-sm">{t("language.description")}</div>
          </div>

          <Select
            aria-label={t("language.title")}
            className="max-w-[200px]"
            isDisabled={isUpdatingPreferences || enabledLocales.length === 0}
            placeholder={t("language.title")}
            value={selectedLocale ?? null}
            variant="secondary"
            onChange={(selected) => {
              if (typeof selected === "string") handleLocaleChange(selected);
            }}
          >
            <Label className="sr-only">{t("language.title")}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {enabledLocales.map((locale) => (
                  <ListBox.Item key={locale.code} id={locale.code} textValue={locale.name}>
                    {locale.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-foreground font-medium">{t("hidden.title")}</div>
            <div className="text-muted text-sm">{t("hidden.description")}</div>
          </div>

          <Select
            aria-label={t("hidden.title")}
            className="max-w-[200px]"
            isDisabled={isUpdatingPreferences}
            placeholder={t("hidden.placeholder")}
            selectionMode="multiple"
            value={selectedHidden}
            variant="secondary"
            onChange={(selected) => handleHiddenChange(selected.map(String))}
          >
            <Label className="sr-only">{t("hidden.title")}</Label>
            <Select.Trigger>
              <Select.Value>
                {({ defaultChildren, isPlaceholder }) =>
                  isPlaceholder
                    ? defaultChildren
                    : selectedHidden.map((item) => t(`hidden.options.${item}`)).join(", ")
                }
              </Select.Value>
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox selectionMode="multiple">
                {offeredHidden.map((item) => (
                  <ListBox.Item key={item} id={item} textValue={t(`hidden.options.${item}`)}>
                    {t(`hidden.options.${item}`)}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-foreground font-medium">{t("todaySection.title")}</div>
            <div className="text-muted text-sm">{t("todaySection.description")}</div>
          </div>

          <Select
            aria-label={t("todaySection.title")}
            className="max-w-[200px]"
            value={todaySectionVisibility}
            variant="secondary"
            onChange={(selected) => {
              if (selected === "always" || selected === "planned" || selected === "hidden") {
                setTodaySectionVisibility(selected);
              }
            }}
          >
            <Label className="sr-only">{t("todaySection.title")}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {todaySectionOptions.map((option) => (
                  <ListBox.Item
                    key={option}
                    id={option}
                    textValue={t(`todaySection.options.${option}`)}
                  >
                    {t(`todaySection.options.${option}`)}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
      </Card.Content>
    </Card>
  );
}
