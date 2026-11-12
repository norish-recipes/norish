"use client";

import { SettingsAccordion, SettingsCard } from "@/components/settings/settings-card";
import { DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import { ServerConfigKeys } from "@norish/config/zod/server-config";
import {
  useAdminConfig,
  useContentConfigWrites,
  useRestoreDefault,
} from "@norish/shared-react/admin";

import { AccordionSection } from "../accordion-section";
import JsonEditor from "./json-editor";
import TimerKeywordsEditor from "./timer-keywords-editor";

export default function ContentDetectionCard() {
  const t = useTranslations("settings.admin.contentDetection");
  const contentIndicators = useAdminConfig(ServerConfigKeys.CONTENT_INDICATORS);
  const units = useAdminConfig(ServerConfigKeys.UNITS, (config) => config?.units);
  const ingredientWords = useAdminConfig(
    ServerConfigKeys.INGREDIENT_WORDS,
    (config) => config?.words
  );
  const recurrenceLocales = useAdminConfig(
    ServerConfigKeys.RECURRENCE_CONFIG,
    (config) => config?.locales
  );
  const timerKeywords = useAdminConfig(ServerConfigKeys.TIMER_KEYWORDS);
  const {
    saveContentIndicators,
    saveUnits,
    saveIngredientWords,
    saveRecurrence,
    saveTimerKeywords,
  } = useContentConfigWrites();
  const restoreDefaultConfig = useRestoreDefault();

  return (
    <SettingsCard
      description={t("description")}
      icon={DocumentMagnifyingGlassIcon}
      title={t("title")}
    >
      <SettingsAccordion>
        <AccordionSection
          id="timer-keywords"
          subtitle={t("timerKeywords.subtitle")}
          title={t("timerKeywords.title")}
        >
          {(onDirtyChange) => (
            <TimerKeywordsEditor
              enabled={timerKeywords?.enabled ?? true}
              hours={timerKeywords?.hours ?? []}
              minutes={timerKeywords?.minutes ?? []}
              seconds={timerKeywords?.seconds ?? []}
              onDirtyChange={onDirtyChange}
              onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.TIMER_KEYWORDS)}
              onUpdate={saveTimerKeywords}
            />
          )}
        </AccordionSection>
        <AccordionSection
          id="content-indicators"
          subtitle={t("contentIndicators.subtitle")}
          title={t("contentIndicators.title")}
        >
          {(onDirtyChange) => (
            <JsonEditor
              description={t("contentIndicators.description")}
              value={contentIndicators}
              onDirtyChange={onDirtyChange}
              onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.CONTENT_INDICATORS)}
              onSave={saveContentIndicators}
            />
          )}
        </AccordionSection>
        <AccordionSection id="units" subtitle={t("units.subtitle")} title={t("units.title")}>
          {(onDirtyChange) => (
            <JsonEditor
              description={t("units.description")}
              value={units}
              onDirtyChange={onDirtyChange}
              onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.UNITS)}
              onSave={saveUnits}
            />
          )}
        </AccordionSection>
        <AccordionSection
          id="ingredient-words"
          subtitle={t("ingredientWords.subtitle")}
          title={t("ingredientWords.title")}
        >
          {(onDirtyChange) => (
            <JsonEditor
              description={t("ingredientWords.description")}
              value={ingredientWords}
              onDirtyChange={onDirtyChange}
              onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.INGREDIENT_WORDS)}
              onSave={saveIngredientWords}
            />
          )}
        </AccordionSection>
        <AccordionSection
          id="recurrence"
          subtitle={t("recurrence.subtitle")}
          title={t("recurrence.title")}
        >
          {(onDirtyChange) => (
            <JsonEditor
              description={t("recurrence.description")}
              value={recurrenceLocales}
              onDirtyChange={onDirtyChange}
              onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.RECURRENCE_CONFIG)}
              onSave={saveRecurrence}
            />
          )}
        </AccordionSection>
      </SettingsAccordion>
    </SettingsCard>
  );
}
