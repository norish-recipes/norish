import React from "react";
import { Checkmark } from "@/components/checkmark";
import { useMobileLocaleSettings } from "@/lib/i18n/mobile-i18n-context";
import { useText } from "@/lib/i18n/use-text";

import { useTimersEnabledQuery } from "@norish/shared-react/config";
import {
  measurementChoices,
  offeredHiddenItems,
  shownMeasurement,
  useDevicePreference,
  usePermissions,
  usePreferencesMutation,
  useProfileQuery,
} from "@norish/shared-react/reader";
import {
  RECIPE_PAGE_COLORS,
  TODAY_SECTION_VISIBILITIES,
  UNIT_STYLES,
} from "@norish/shared/contracts/zod/device-preferences";
import { AFTER_PLANNING_CHOICES } from "@norish/shared/contracts/zod/user";
import {
  getAfterPlanningPreference,
  getMeasurementSystemPreference,
} from "@norish/shared/lib/user-preferences";

import { toggledHiddenItems } from "../utils/preferences-rules";
import { settingsWrite } from "../utils/settings-write";
import { ChoiceRow } from "./choice-row";
import { SettingsGroup } from "./settings-group";
import { SettingsRow } from "./settings-row";

/** Preferences: the choices that follow the account, those of the phone Device Kind, and its Hidden Items. */
export function PreferencesForm() {
  const { user } = useProfileQuery();
  const { updatePreferences, isUpdatingPreferences } = usePreferencesMutation();
  const { globalEnabled } = useTimersEnabledQuery();
  const isAIEnabled = usePermissions((permissions) => permissions.isAIEnabled);
  const { locale, options, setLocale } = useMobileLocaleSettings();
  const [today, setToday] = useDevicePreference("todaySectionVisibility");
  const [pageColor, setPageColor] = useDevicePreference("recipePageColor");
  const [unitStyle, setUnitStyle] = useDevicePreference("unitStyle");
  const [hidden, setHidden] = useDevicePreference("hiddenItems");
  const text = useText();
  const offered = offeredHiddenItems(globalEnabled);

  return (
    <>
      <SettingsGroup title={text("settings.mobile.accountGroup")}>
        <ChoiceRow
          optionLabel={(code) => options.find((option) => option.code === code)?.name ?? code}
          options={options.map((option) => option.code)}
          saving={isUpdatingPreferences}
          testID="settings-preferences-language"
          title={text("settings.user.preferences.language.title")}
          value={locale}
          onChange={settingsWrite((code: string) => setLocale(code))}
        />
        <ChoiceRow
          optionLabel={(choice) =>
            text(`settings.user.preferences.afterPlanning.options.${choice}`)
          }
          options={AFTER_PLANNING_CHOICES}
          saving={isUpdatingPreferences}
          testID="settings-preferences-after-planning"
          title={text("settings.user.preferences.afterPlanning.title")}
          value={getAfterPlanningPreference(user)}
          onChange={settingsWrite((afterPlanning) => void updatePreferences({ afterPlanning }))}
        />
        <ChoiceRow
          optionLabel={(choice) => text(`settings.user.preferences.measurements.options.${choice}`)}
          options={measurementChoices(isAIEnabled)}
          saving={isUpdatingPreferences}
          testID="settings-preferences-measurements"
          title={text("settings.user.preferences.measurements.title")}
          value={shownMeasurement(getMeasurementSystemPreference(user), isAIEnabled)}
          onChange={settingsWrite(
            (measurementSystem) => void updatePreferences({ measurementSystem })
          )}
        />
      </SettingsGroup>
      <SettingsGroup title={text("settings.mobile.phonesGroup")}>
        <ChoiceRow
          optionLabel={(choice) => text(`settings.user.preferences.todaySection.options.${choice}`)}
          options={TODAY_SECTION_VISIBILITIES}
          testID="settings-preferences-today"
          title={text("settings.user.preferences.todaySection.title")}
          value={today}
          onChange={settingsWrite(setToday)}
        />
        <ChoiceRow
          optionLabel={(choice) =>
            text(`settings.user.preferences.recipePageColor.options.${choice}`)
          }
          options={RECIPE_PAGE_COLORS}
          testID="settings-preferences-page-color"
          title={text("settings.user.preferences.recipePageColor.title")}
          value={pageColor}
          onChange={settingsWrite(setPageColor)}
        />
        <ChoiceRow
          optionLabel={(choice) => text(`settings.user.preferences.unitStyle.options.${choice}`)}
          options={UNIT_STYLES}
          testID="settings-preferences-units"
          title={text("settings.user.preferences.unitStyle.title")}
          value={unitStyle}
          onChange={settingsWrite(setUnitStyle)}
        />
      </SettingsGroup>
      <SettingsGroup title={text("settings.user.preferences.hidden.title")}>
        {offered.map((item) => (
          <SettingsRow
            key={item}
            write
            testID={`settings-preferences-hidden-${item}`}
            title={text(`settings.user.preferences.hidden.options.${item}`)}
            trailing={hidden.includes(item) ? <Checkmark /> : null}
            onPress={settingsWrite(() =>
              setHidden((stored) => toggledHiddenItems(stored, offered, item))
            )}
          />
        ))}
      </SettingsGroup>
    </>
  );
}
