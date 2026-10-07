"use client";

import { useCallback, useState } from "react";
import { SettingsAccordion, SettingsCard } from "@/app/(app)/settings/components/settings-card";
import { DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Accordion } from "@heroui/react";
import { useTranslations } from "next-intl";

import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { useAdminSettingsContext } from "../context";
import JsonEditor from "./json-editor";
import TimerKeywordsEditor from "./timer-keywords-editor";
import { UnsavedChangesChip } from "./unsaved-changes-chip";

export default function ContentDetectionCard() {
  const t = useTranslations("settings.admin.contentDetection");
  const {
    contentIndicators,
    units,
    ingredientWords,
    recurrenceConfig,
    timerKeywords,
    updateContentIndicators,
    updateUnits,
    updateIngredientWords,
    updateRecurrenceConfig,
    updateTimerKeywords,
    restoreDefaultConfig,
  } = useAdminSettingsContext();

  const [dirtySections, setDirtySections] = useState({
    timerKeywords: false,
    contentIndicators: false,
    units: false,
    ingredientWords: false,
    recurrence: false,
  });

  const updateDirtySection = useCallback(
    (section: keyof typeof dirtySections) => (isDirty: boolean) => {
      setDirtySections((current) =>
        current[section] === isDirty ? current : { ...current, [section]: isDirty }
      );
    },
    []
  );

  return (
    <SettingsCard
      description={t("description")}
      icon={DocumentMagnifyingGlassIcon}
      title={t("title")}
    >
      <SettingsAccordion>
        <Accordion.Item id="timer-keywords">
          <Accordion.Heading>
            <Accordion.Trigger>
              <div className="flex min-w-0 flex-col items-start gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {t("timerKeywords.title")}
                  {dirtySections.timerKeywords && <UnsavedChangesChip />}
                </div>
                <span className="text-muted text-sm">{t("timerKeywords.subtitle")}</span>
              </div>
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <div>
                <TimerKeywordsEditor
                  enabled={timerKeywords?.enabled ?? true}
                  hours={timerKeywords?.hours ?? []}
                  minutes={timerKeywords?.minutes ?? []}
                  seconds={timerKeywords?.seconds ?? []}
                  onDirtyChange={updateDirtySection("timerKeywords")}
                  onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.TIMER_KEYWORDS)}
                  onUpdate={updateTimerKeywords}
                />
              </div>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item id="content-indicators">
          <Accordion.Heading>
            <Accordion.Trigger>
              <div className="flex min-w-0 flex-col items-start gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {t("contentIndicators.title")}
                  {dirtySections.contentIndicators && <UnsavedChangesChip />}
                </div>
                <span className="text-muted text-sm">{t("contentIndicators.subtitle")}</span>
              </div>
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <div>
                <JsonEditor
                  description={t("contentIndicators.description")}
                  value={contentIndicators}
                  onDirtyChange={updateDirtySection("contentIndicators")}
                  onRestoreDefaults={() =>
                    restoreDefaultConfig(ServerConfigKeys.CONTENT_INDICATORS)
                  }
                  onSave={updateContentIndicators}
                />
              </div>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item id="units">
          <Accordion.Heading>
            <Accordion.Trigger>
              <div className="flex min-w-0 flex-col items-start gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {t("units.title")}
                  {dirtySections.units && <UnsavedChangesChip />}
                </div>
                <span className="text-muted text-sm">{t("units.subtitle")}</span>
              </div>
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <div>
                <JsonEditor
                  description={t("units.description")}
                  value={units}
                  onDirtyChange={updateDirtySection("units")}
                  onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.UNITS)}
                  onSave={updateUnits}
                />
              </div>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item id="ingredient-words">
          <Accordion.Heading>
            <Accordion.Trigger>
              <div className="flex min-w-0 flex-col items-start gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {t("ingredientWords.title")}
                  {dirtySections.ingredientWords && <UnsavedChangesChip />}
                </div>
                <span className="text-muted text-sm">{t("ingredientWords.subtitle")}</span>
              </div>
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <div>
                <JsonEditor
                  description={t("ingredientWords.description")}
                  value={ingredientWords}
                  onDirtyChange={updateDirtySection("ingredientWords")}
                  onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.INGREDIENT_WORDS)}
                  onSave={updateIngredientWords}
                />
              </div>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item id="recurrence">
          <Accordion.Heading>
            <Accordion.Trigger>
              <div className="flex min-w-0 flex-col items-start gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {t("recurrence.title")}
                  {dirtySections.recurrence && <UnsavedChangesChip />}
                </div>
                <span className="text-muted text-sm">{t("recurrence.subtitle")}</span>
              </div>
              <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body>
              <div>
                <JsonEditor
                  description={t("recurrence.description")}
                  value={recurrenceConfig}
                  onDirtyChange={updateDirtySection("recurrence")}
                  onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.RECURRENCE_CONFIG)}
                  onSave={updateRecurrenceConfig}
                />
              </div>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      </SettingsAccordion>
    </SettingsCard>
  );
}
