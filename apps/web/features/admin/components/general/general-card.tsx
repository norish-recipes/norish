"use client";

import { useState } from "react";
import ArchiveExportButton from "@/components/settings/archive-export-button";
import { SettingRow, SwitchRow } from "@/components/settings/setting-row";
import { SettingsCard } from "@/components/settings/settings-card";
import SettingsSwitch from "@/components/settings/settings-switch";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { usePending } from "@/hooks/use-pending";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { ListBox, Select, Separator, toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { useAdminConfig, useGeneralConfigMutations } from "@norish/shared-react/admin";

import { UnsavedChangesChip } from "../unsaved-changes-chip";

export default function GeneralCard() {
  const t = useTranslations("settings.admin.general");
  const tActions = useTranslations("common.actions");
  const registrationEnabled = useAdminConfig(ServerConfigKeys.REGISTRATION_ENABLED);
  const localeConfig = useAdminConfig(ServerConfigKeys.LOCALE_CONFIG);
  const { setRegistration, saveLocales } = useGeneralConfigMutations();

  // Local state for locale config form
  const [enabledLocales, setEnabledLocales] = useState<string[]>([]);
  const [defaultLocale, setDefaultLocale] = useState<string>("");
  const [isSaving, whileSaving] = usePending();

  // Initialize local state from config; starts unset so a config present on
  // the first render seeds it too.
  const [prevLocaleConfig, setPrevLocaleConfig] = useState<typeof localeConfig>();

  if (localeConfig !== prevLocaleConfig) {
    setPrevLocaleConfig(localeConfig);
    if (localeConfig) {
      const enabled = Object.entries(localeConfig.locales)
        .filter(([_, entry]) => entry.enabled)
        .map(([code]) => code);
      setEnabledLocales(enabled);
      setDefaultLocale(localeConfig.defaultLocale);
    }
  }
  const handleRegistrationToggle = async (checked: boolean) => {
    await setRegistration(checked);
  };
  const handleEnabledLocalesChange = (values: string[]) => {
    // Ensure at least one locale is enabled
    if (values.length === 0) {
      toast(t("atLeastOneLocale"), {
        variant: "warning",
      });
      return;
    }
    setEnabledLocales(values);

    // If default locale is no longer enabled, switch to first enabled
    if (!values.includes(defaultLocale)) {
      const firstEnabled = values[0];
      if (firstEnabled) {
        setDefaultLocale(firstEnabled);
      }
    }
  };
  const handleSaveLocales = async () => {
    if (enabledLocales.length === 0) {
      toast(t("atLeastOneLocale"), {
        variant: "warning",
      });
      return;
    }
    await whileSaving(() => saveLocales({ defaultLocale, enabledLocales }));
  };

  // Check if locale config has changed from server state
  const hasLocaleChanges = (() => {
    if (!localeConfig) return false;
    const serverEnabled = Object.entries(localeConfig.locales)
      .filter(([_, entry]) => entry.enabled)
      .map(([code]) => code)
      .sort((a, b) => a.localeCompare(b));
    const localEnabled = [...enabledLocales].sort((a, b) => a.localeCompare(b));
    if (serverEnabled.length !== localEnabled.length) return true;
    if (!serverEnabled.every((v, i) => v === localEnabled[i])) return true;
    if (localeConfig.defaultLocale !== defaultLocale) return true;
    return false;
  })();

  // Get all locales for display
  const allLocales = localeConfig
    ? Object.entries(localeConfig.locales).map(([code, entry]) => ({
        code,
        name: entry.name,
      }))
    : [];

  // Filter enabled locales for default selector
  const enabledLocaleOptions = allLocales.filter((l) => enabledLocales.includes(l.code));
  return (
    <SettingsCard contentClassName="gap-6" icon={Cog6ToothIcon} title={t("title")}>
      {/* Registration Toggle */}
      <SwitchRow description={t("registrationDescription")} title={t("allowRegistration")}>
        <SettingsSwitch
          isSelected={registrationEnabled ?? false}
          onValueChange={handleRegistrationToggle}
        />
      </SwitchRow>

      <Separator />

      {/* Locale Configuration */}
      <SettingRow
        badges={hasLocaleChanges ? <UnsavedChangesChip /> : null}
        description={t("localesDescription")}
        title={t("locales")}
      >
        <Select
          aria-label={t("locales")}
          className="w-full"
          isDisabled={isSaving}
          placeholder={t("locales")}
          value={enabledLocales}
          selectionMode="multiple"
          variant="secondary"
          onChange={(keys) => handleEnabledLocalesChange(keys.map(String))}
        >
          <Select.Trigger>
            <Select.Value className="min-w-0">
              {({ defaultChildren, isPlaceholder }) =>
                isPlaceholder ? (
                  defaultChildren
                ) : (
                  <span className="block truncate">
                    {enabledLocaleOptions.map((locale) => locale.name).join(", ")}
                  </span>
                )
              }
            </Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox selectionMode="multiple">
              {allLocales.map((locale) => (
                <ListBox.Item key={locale.code} id={locale.code} textValue={locale.name}>
                  {locale.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </SettingRow>

      {/* Default Locale Selector */}
      <SettingRow description={t("defaultLocaleDescription")} title={t("defaultLocale")}>
        <Select
          aria-label={t("defaultLocale")}
          variant="secondary"
          className="w-full"
          isDisabled={isSaving}
          placeholder={t("defaultLocale")}
          value={defaultLocale || null}
          onChange={(selected) => {
            if (typeof selected === "string" && selected) {
              setDefaultLocale(selected);
            }
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {enabledLocaleOptions.map((locale) => (
                <ListBox.Item key={locale.code} id={locale.code} textValue={locale.name}>
                  {locale.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </SettingRow>

      <ActionButtonGroup>
        <ActionButton
          action="save"
          isDisabled={!hasLocaleChanges}
          isPending={isSaving}
          onPress={handleSaveLocales}
        >
          {tActions("save")}
        </ActionButton>
      </ActionButtonGroup>

      <Separator />

      {/* Instance-wide Recipe Archive export */}
      <SettingRow description={t("export.description")} title={t("export.title")}>
        <ArchiveExportButton fullWidth label={t("export.button")} scope="instance" />
      </SettingRow>
    </SettingsCard>
  );
}
