"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Switch,
  Select,
  SelectItem,
  Button,
  addToast,
  Divider,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@heroui/react";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useAdminSettingsContext } from "../context";

import { UnsavedChangesChip } from "./unsaved-changes-chip";

export default function GeneralCard() {
  const t = useTranslations("settings.admin.general");
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
      addToast({
        title: t("atLeastOneLocale"),
        color: "warning",
      });

      return;
    }
    setEnabledLocales(values);

    // If default locale is no longer enabled, switch to first enabled
    if (!values.includes(defaultLocale)) {
      setDefaultLocale(values[0]);
    }
  };

  const handleLocaleToggle = (code: string, enabled: boolean) => {
    if (enabled) {
      handleEnabledLocalesChange([...enabledLocales, code]);
    } else {
      handleEnabledLocalesChange(enabledLocales.filter((c) => c !== code));
    }
  };

  const handleDefaultLocaleChange = (keys: "all" | Set<React.Key>) => {
    if (keys === "all" || keys.size === 0) return;
    const selected = Array.from(keys)[0];

    if (typeof selected === "string") {
      setDefaultLocale(selected);
    }
  };

  const handleSaveLocales = async () => {
    if (enabledLocales.length === 0) {
      addToast({
        title: t("atLeastOneLocale"),
        color: "warning",
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
        addToast({
          title: t("localesSaved"),
          color: "success",
        });
      } else {
        addToast({
          title: t("localesError"),
          description: result.error,
          color: "danger",
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
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Cog6ToothIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </CardHeader>
      <CardBody className="flex flex-col gap-6">
        {/* Registration Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{t("allowRegistration")}</span>
            <span className="text-default-500 text-base">{t("registrationDescription")}</span>
          </div>
          <Switch
            color="success"
            isDisabled={isLoading}
            isSelected={registrationEnabled ?? false}
            onValueChange={handleRegistrationToggle}
          />
        </div>

        <Divider />

        {/* Locale Configuration */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 font-medium">
              {t("locales")}
              {hasLocaleChanges && <UnsavedChangesChip />}
            </span>
            <span className="text-default-500 text-base">{t("localesDescription")}</span>
          </div>

          <Popover placement="bottom-start">
            <PopoverTrigger>
              <Button
                className="max-w-xs justify-between"
                endContent={<ChevronDownIcon className="h-4 w-4 shrink-0" />}
                isDisabled={isLoading || isSaving}
                variant="bordered"
              >
                <span className="truncate">
                  {enabledLocaleOptions.map((l) => l.name).join(", ") || t("locales")}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 items-stretch p-0">
              <div className="flex w-full flex-col">
                {allLocales.map((locale) => (
                  <div
                    key={locale.code}
                    className="hover:bg-default-100 flex w-full items-center justify-between px-4 py-3"
                  >
                    <span className="flex-1 text-sm">{locale.name}</span>
                    <Switch
                      isDisabled={isLoading || isSaving}
                      isSelected={enabledLocales.includes(locale.code)}
                      size="sm"
                      onValueChange={(checked) => handleLocaleToggle(locale.code, checked)}
                    />
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Default Locale Selector */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{t("defaultLocale")}</span>
            <span className="text-default-500 text-base">{t("defaultLocaleDescription")}</span>
          </div>

          <Select
            className="max-w-xs"
            isDisabled={isLoading || isSaving}
            label={t("defaultLocale")}
            selectedKeys={new Set([defaultLocale])}
            onSelectionChange={handleDefaultLocaleChange}
          >
            {enabledLocaleOptions.map((locale) => (
              <SelectItem key={locale.code}>{locale.name}</SelectItem>
            ))}
          </Select>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            color="primary"
            isDisabled={isLoading || !hasLocaleChanges}
            isLoading={isSaving}
            onPress={handleSaveLocales}
          >
            {t("saveLocales")}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
