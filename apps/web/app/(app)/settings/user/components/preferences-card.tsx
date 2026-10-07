"use client";

import type { TodaySectionVisibility } from "@/lib/todays-meals-visibility";
import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SettingRow } from "@/app/(app)/settings/components/setting-row";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { useHiddenItemsState } from "@/context/hidden-items-context";
import { useRecipePageColor } from "@/context/recipe-page-color-context";
import { useTodaySectionVisibility } from "@/context/todays-meals-visibility-context";
import { useLocaleConfigQuery, useTimersEnabledQuery } from "@/hooks/config";
import { HIDDEN_ITEMS, partitionHiddenItems } from "@/lib/hidden-items";
import { recipePageColorPreference } from "@/lib/recipe-page-color";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { Label, ListBox, Select } from "@heroui/react";
import { useTranslations } from "next-intl";

import { getLocalePreference } from "@norish/shared/lib/user-preferences";

import { useUserSettingsContext } from "../context";

export default function PreferencesCard() {
  const t = useTranslations("settings.user.preferences");
  const { user, updatePreferences, isUpdatingPreferences } = useUserSettingsContext();
  const { globalEnabled } = useTimersEnabledQuery();
  const { enabledLocales, defaultLocale } = useLocaleConfigQuery();
  const router = useRouter();
  const [todaySectionVisibility, setTodaySectionVisibility] = useTodaySectionVisibility();
  const [hiddenItems, setHiddenItems] = useHiddenItemsState();
  const [recipePageColor, setRecipePageColor] = useRecipePageColor();

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

  const { selected: selectedHidden, carried } = partitionHiddenItems(hiddenItems, offeredHidden);

  const handleHiddenChange = useCallback(
    (chosen: string[]) => {
      setHiddenItems([...chosen, ...carried]);
    },
    [setHiddenItems, carried]
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
    <SettingsCard
      description={t("description")}
      icon={AdjustmentsHorizontalIcon}
      title={t("title")}
    >
      <SettingRow description={t("language.description")} title={t("language.title")}>
        <Select
          aria-label={t("language.title")}
          className="w-full"
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
      </SettingRow>

      <SettingRow description={t("hidden.description")} title={t("hidden.title")}>
        <Select
          aria-label={t("hidden.title")}
          className="w-full"
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
      </SettingRow>
      <SettingRow description={t("todaySection.description")} title={t("todaySection.title")}>
        <Select
          aria-label={t("todaySection.title")}
          className="w-full"
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
      </SettingRow>

      {/* A choice between two colourings, not a Hidden Item: nothing is
            hidden and the page is no slimmer for it (ADR-0023). */}
      <SettingRow description={t("recipePageColor.description")} title={t("recipePageColor.title")}>
        <Select
          aria-label={t("recipePageColor.title")}
          className="w-full"
          value={recipePageColor}
          variant="secondary"
          onChange={(selected) => {
            if (selected === "dish" || selected === "theme") {
              setRecipePageColor(selected);
            }
          }}
        >
          <Label className="sr-only">{t("recipePageColor.title")}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {recipePageColorPreference.values.map((option) => (
                <ListBox.Item
                  key={option}
                  id={option}
                  textValue={t(`recipePageColor.options.${option}`)}
                >
                  {t(`recipePageColor.options.${option}`)}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </SettingRow>
    </SettingsCard>
  );
}
