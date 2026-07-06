"use client";

import type { Key } from "react";
import { useEffect, useState } from "react";
import SettingsSwitch from "@/app/(app)/settings/components/settings-switch";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { Button, Card, Label, ListBox, Select, Separator, toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useAdminSettingsContext } from "../context";
import { UnsavedChangesChip } from "./unsaved-changes-chip";

export default function GeneralCard() {
  const t = useTranslations("settings.admin.general");
  const tErrors = useTranslations("common.errors");
  const { registrationEnabled, updateRegistration, localeConfig, updateLocaleConfig, isLoading } =
    useAdminSettingsContext();

  // Local state for locale config form
  const [enabledLocales, setEnabledLocales] = useState<string[]>([]);
  const [defaultLocale, setDefaultLocale] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Initialize local state from config
  useEffect(() => {
    if (localeConfig) {
      const enabled = Object.entries(localeConfig.locales)
        .filter(([_, entry]) => entry.enabled)
        .map(([code]) => code);
      setEnabledLocales(enabled);
      setDefaultLocale(localeConfig.defaultLocale);
    }
  }, [localeConfig]);
  const handleRegistrationToggle = async (checked: boolean) => {
    await updateRegistration(checked);
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
    setIsSaving(true);
    try {
      const result = await updateLocaleConfig({
        defaultLocale,
        enabledLocales,
      });
      if (result.success) {
        toast(t("localesSaved"), {
          variant: "success",
        });
      } else {
        showSafeErrorToast({
          title: t("localesError"),
          description: tErrors("technicalDetails"),
          color: "danger",
          error: result.error,
          context: "admin-general:save-locales",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Check if locale config has changed from server state
  const hasLocaleChanges = (() => {
    if (!localeConfig) return false;
    const serverEnabled = Object.entries(localeConfig.locales)
      .filter(([_, entry]) => entry.enabled)
      .map(([code]) => code)
      .sort();
    const localEnabled = [...enabledLocales].sort();
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
    <Card>
      <Card.Header>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Cog6ToothIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </Card.Header>
      <Card.Content className="flex flex-col gap-6">
        {/* Registration Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{t("allowRegistration")}</span>
            <span className="text-muted text-base">{t("registrationDescription")}</span>
          </div>
          <SettingsSwitch
            color="success"
            isDisabled={isLoading}
            isSelected={registrationEnabled ?? false}
            onValueChange={handleRegistrationToggle}
          />
        </div>

        <Separator />

        {/* Locale Configuration */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 font-medium">
              {t("locales")}
              {hasLocaleChanges && <UnsavedChangesChip />}
            </span>
            <span className="text-muted text-base">{t("localesDescription")}</span>
          </div>

          <Select
            className="max-w-xs"
            isDisabled={isLoading || isSaving}
            placeholder={t("locales")}
            selectedKeys={new Set(enabledLocales)}
            selectionMode="multiple"
            variant="secondary"
            onSelectionChange={(keys) => {
              const selected =
                keys === "all"
                  ? allLocales.map((locale) => locale.code)
                  : Array.from(keys as Set<Key>, String);

              handleEnabledLocalesChange(selected);
            }}
          >
            <Label>{t("locales")}</Label>
            <Select.Trigger>
              <Select.Value>
                {({ defaultChildren, isPlaceholder }) =>
                  isPlaceholder
                    ? defaultChildren
                    : enabledLocaleOptions.map((locale) => locale.name).join(", ")
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
        </div>

        {/* Default Locale Selector */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{t("defaultLocale")}</span>
            <span className="text-muted text-base">{t("defaultLocaleDescription")}</span>
          </div>

          <Select
            variant="secondary"
            className="max-w-xs"
            isDisabled={isLoading || isSaving}
            placeholder={t("defaultLocale")}
            selectedKey={defaultLocale || null}
            onSelectionChange={(selected) => {
              if (typeof selected === "string" && selected) {
                setDefaultLocale(selected);
              }
            }}
          >
            <Label>{t("defaultLocale")}</Label>
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
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            isDisabled={isLoading || !hasLocaleChanges}
            onPress={handleSaveLocales}
            variant="primary"
            isPending={isSaving}
          >
            {t("saveLocales")}
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}
