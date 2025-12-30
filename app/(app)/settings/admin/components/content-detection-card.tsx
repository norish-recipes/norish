"use client";

import { Card, CardBody, CardHeader, Accordion, AccordionItem } from "@heroui/react";
import { DocumentMagnifyingGlassIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useAdminSettingsContext } from "../context";

import JsonEditor from "./json-editor";

import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

export default function ContentDetectionCard() {
  const t = useTranslations("settings.admin.contentDetection");
  const {
    contentIndicators,
    units,
    recurrenceConfig,
    updateContentIndicators,
    updateUnits,
    updateRecurrenceConfig,
    restoreDefaultConfig,
  } = useAdminSettingsContext();

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <DocumentMagnifyingGlassIcon className="h-5 w-5" />
          {t("title")}
        </h2>
      </CardHeader>
      <CardBody>
        <p className="text-default-500 mb-4 text-base">
          {t("description")}
        </p>
        <Accordion selectionMode="multiple" variant="bordered">
          <AccordionItem
            key="content-indicators"
            subtitle={t("contentIndicators.subtitle")}
            title={t("contentIndicators.title")}
          >
            <div className="p-2">
              <JsonEditor
                description={t("contentIndicators.description")}
                value={contentIndicators}
                onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.CONTENT_INDICATORS)}
                onSave={updateContentIndicators}
              />
            </div>
          </AccordionItem>

          <AccordionItem
            key="units"
            subtitle={t("units.subtitle")}
            title={t("units.title")}
          >
            <div className="p-2">
              <JsonEditor
                description={t("units.description")}
                value={units}
                onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.UNITS)}
                onSave={updateUnits}
              />
            </div>
          </AccordionItem>

          <AccordionItem
            key="recurrence"
            subtitle={t("recurrence.subtitle")}
            title={t("recurrence.title")}
          >
            <div className="p-2">
              <JsonEditor
                description={t("recurrence.description")}
                value={recurrenceConfig}
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
