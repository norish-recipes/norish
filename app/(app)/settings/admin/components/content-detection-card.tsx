"use client";

import { Card, CardBody, CardHeader, Accordion, AccordionItem } from "@heroui/react";
import { DocumentMagnifyingGlassIcon } from "@heroicons/react/16/solid";

import { useAdminSettingsContext } from "../context";

import JsonEditor from "./json-editor";

import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

export default function ContentDetectionCard() {
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
          Content Detection
        </h2>
      </CardHeader>
      <CardBody>
        <p className="text-default-500 mb-4 text-base">
          Configure how recipes are detected and parsed from web pages.
        </p>
        <Accordion selectionMode="multiple" variant="bordered">
          <AccordionItem
            key="content-indicators"
            subtitle="Keywords that identify recipe pages"
            title="Content Indicators"
          >
            <div className="p-2">
              <JsonEditor
                description="Schema indicators detect structured recipe data (JSON-LD, microdata). Content indicators are keywords that suggest a page contains a recipe."
                value={contentIndicators}
                onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.CONTENT_INDICATORS)}
                onSave={updateContentIndicators}
              />
            </div>
          </AccordionItem>

          <AccordionItem
            key="units"
            subtitle="Measurement unit definitions for parsing"
            title="Units of Measure"
          >
            <div className="p-2">
              <JsonEditor
                description="Define measurement units with their short form, plural, and alternate spellings. Used when parsing ingredient quantities."
                value={units}
                onRestoreDefaults={() => restoreDefaultConfig(ServerConfigKeys.UNITS)}
                onSave={updateUnits}
              />
            </div>
          </AccordionItem>

          <AccordionItem
            key="recurrence"
            subtitle="Natural language patterns for recurring items"
            title="Recurrence Patterns"
          >
            <div className="p-2">
              <JsonEditor
                description="Define locale-specific patterns for parsing recurrence rules from natural language (e.g., 'every week', 'om de dag')."
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
