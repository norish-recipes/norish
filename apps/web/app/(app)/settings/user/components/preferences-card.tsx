"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SettingRow } from "@/app/(app)/settings/components/setting-row";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { InfoHint } from "@/components/shared/info-hint";
import { useDeviceKind, useDevicePreference } from "@/context/device-preferences-context";
import { useLocaleConfigQuery, useTimersEnabledQuery } from "@/hooks/config";
import { HIDDEN_ITEMS, partitionHiddenItems } from "@/lib/hidden-items";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { Label, ListBox, Select } from "@heroui/react";
import { useTranslations } from "next-intl";

import {
  RECIPE_PAGE_COLORS,
  TODAY_SECTION_VISIBILITIES,
} from "@norish/shared/contracts/zod/device-preferences";
import { AFTER_PLANNING_CHOICES } from "@norish/shared/contracts/zod/user";
import {
  getAfterPlanningPreference,
  getLocalePreference,
} from "@norish/shared/lib/user-preferences";

import { useUserSettingsContext } from "../context";

export default function PreferencesCard() {
  const t = useTranslations("settings.user.preferences");
  const { user, updatePreferences, isUpdatingPreferences } = useUserSettingsContext();
  const { globalEnabled } = useTimersEnabledQuery();
  const { enabledLocales, defaultLocale } = useLocaleConfigQuery();
  const router = useRouter();
  const [todaySectionVisibility, setTodaySectionVisibility] =
    useDevicePreference("todaySectionVisibility");
  const [hiddenItems, setHiddenItems] = useDevicePreference("hiddenItems");
  const [recipePageColor, setRecipePageColor] = useDevicePreference("recipePageColor");
  const deviceKind = useDeviceKind();

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
      // Which rows follow the account and which are Device Preferences.
      badges={
        <InfoHint label={t("deviceKind.help")}>
          {t(`deviceKind.${deviceKind}`, {
            language: t("language.title"),
            afterPlanning: t("afterPlanning.title"),
          })}
        </InfoHint>
      }
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

      {/* Stored with the user, on every device: it is about how they plan. */}
      <SettingRow description={t("afterPlanning.description")} title={t("afterPlanning.title")}>
        <ChoiceSelect
          isDisabled={isUpdatingPreferences}
          label={t("afterPlanning.title")}
          optionLabel={(option) => t(`afterPlanning.options.${option}`)}
          options={AFTER_PLANNING_CHOICES}
          value={getAfterPlanningPreference(user)}
          onChange={(afterPlanning) => void updatePreferences({ afterPlanning })}
        />
      </SettingRow>
      {/* The rows below are Device Preferences: they change the kind in use. */}
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
        <ChoiceSelect
          label={t("todaySection.title")}
          optionLabel={(option) => t(`todaySection.options.${option}`)}
          options={TODAY_SECTION_VISIBILITIES}
          value={todaySectionVisibility}
          onChange={setTodaySectionVisibility}
        />
      </SettingRow>

      {/* A choice between two colourings, not a Hidden Item: nothing is
            hidden and the page is no slimmer for it (ADR-0023). */}
      <SettingRow description={t("recipePageColor.description")} title={t("recipePageColor.title")}>
        <ChoiceSelect
          label={t("recipePageColor.title")}
          optionLabel={(option) => t(`recipePageColor.options.${option}`)}
          options={RECIPE_PAGE_COLORS}
          value={recipePageColor}
          onChange={setRecipePageColor}
        />
      </SettingRow>
    </SettingsCard>
  );
}

/** A Select over a fixed set of choices; only a choice from the set reaches `onChange`. */
function ChoiceSelect<T extends string>({
  label,
  options,
  value,
  optionLabel,
  onChange,
  isDisabled,
}: {
  label: string;
  options: readonly T[];
  value: T;
  optionLabel: (option: T) => string;
  onChange: (choice: T) => void;
  isDisabled?: boolean;
}) {
  return (
    <Select
      aria-label={label}
      className="w-full"
      isDisabled={isDisabled}
      value={value}
      variant="secondary"
      onChange={(selected) => {
        const choice = options.find((option) => option === selected);

        if (choice) onChange(choice);
      }}
    >
      <Label className="sr-only">{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item key={option} id={option} textValue={optionLabel(option)}>
              {optionLabel(option)}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
