"use client";

import { useCallback, useState } from "react";
import { DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Accordion, AccordionItem, Card, CardBody, CardHeader } from "@heroui/react";
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
    recurrenceConfig,
    timerKeywords,
    updateContentIndicators,
    updateUnits,
    updateRecurrenceConfig,
    updateTimerKeywords,
    restoreDefaultConfig,
  } = useAdminSettingsContext();

  const [dirtySections, setDirtySections] = useState({
    timerKeywords: false,
    contentIndicators: false,
    units: false,
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
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <DocumentMagnifyingGlassIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </CardHeader>
      <CardBody>
        <p className="text-default-500 mb-4 text-base">{t("description")}</p>

        <Accordion selectionMode="multiple" variant="bordered">
          <AccordionItem
            key="timer-keywords"
            subtitle={t("timerKeywords.subtitle")}
            title={
              <div className="flex items-center gap-2">
                {t("timerKeywords.title")}
                {dirtySections.timerKeywords && <UnsavedChangesChip />}
              </div>
            }
          >
            <div className="p-2">
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
          </AccordionItem>
          <AccordionItem
            key="content-indicators"
            subtitle={t("contentIndicators.subtitle")}
            title={
              <div className="flex items-center gap-2">
                {t("contentIndicators.title")}
                {dirtySections.contentIndicators && <UnsavedChangesChip />}
              </div>
            }
          >
            <div className="p-2">
              <JsonEditor
                description={t("contentIndicators.description")}
                value={contentIndicators}
                onDirtyChange={updateDirtySection("contentIndicators")}
                onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.CONTENT_INDICATORS)}
                onSave={updateContentIndicators}
              />
            </div>
          </AccordionItem>
          <AccordionItem
            key="units"
            subtitle={t("units.subtitle")}
            title={
              <div className="flex items-center gap-2">
                {t("units.title")}
                {dirtySections.units && <UnsavedChangesChip />}
              </div>
            }
          >
            <div className="p-2">
              <JsonEditor
                description={t("units.description")}
                value={units}
                onDirtyChange={updateDirtySection("units")}
                onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.UNITS)}
                onSave={updateUnits}
              />
            </div>
          </AccordionItem>
          <AccordionItem
            key="recurrence"
            subtitle={t("recurrence.subtitle")}
            title={
              <div className="flex items-center gap-2">
                {t("recurrence.title")}
                {dirtySections.recurrence && <UnsavedChangesChip />}
              </div>
            }
          >
            <div className="p-2">
              <JsonEditor
                description={t("recurrence.description")}
                value={recurrenceConfig}
                onDirtyChange={updateDirtySection("recurrence")}
                onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.RECURRENCE_CONFIG)}
                onSave={updateRecurrenceConfig}
              />
            </div>
          </AccordionItem>
        </Accordion>
      </CardBody>
    </Card>
  );
}
