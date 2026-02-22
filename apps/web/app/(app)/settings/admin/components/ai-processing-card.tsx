"use client";

import { Card, CardBody, CardHeader, Accordion, AccordionItem } from "@heroui/react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import AIConfigForm from "./ai-config-form";
import VideoProcessingForm from "./video-processing-form";
import PromptsForm from "./prompts-form";
import BulkCategorizationForm from "./bulk-categorization-form";
import { UnsavedChangesChip } from "./unsaved-changes-chip";

export default function AIProcessingCard() {
  const t = useTranslations("settings.admin.aiProcessing");
  const [dirtySections, setDirtySections] = useState({ ai: false, video: false, prompts: false });

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
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
        </div>
      </CardHeader>
      <CardBody>
        <p className="text-default-500 mb-4 text-base">{t("description")}</p>
        <Accordion selectionMode="multiple" variant="bordered">
          <AccordionItem
            key="ai"
            subtitle={t("aiConfig.subtitle")}
            title={
              <div className="flex items-center gap-2">
                {t("aiConfig.title")}
                {dirtySections.ai && <UnsavedChangesChip />}
              </div>
            }
          >
            <AIConfigForm onDirtyChange={updateDirtySection("ai")} />
          </AccordionItem>

          <AccordionItem
            key="video"
            subtitle={t("video.subtitle")}
            title={
              <div className="flex items-center gap-2">
                {t("video.title")}
                {dirtySections.video && <UnsavedChangesChip />}
              </div>
            }
          >
            <VideoProcessingForm onDirtyChange={updateDirtySection("video")} />
          </AccordionItem>

          <AccordionItem
            key="prompts"
            subtitle={t("prompts.subtitle")}
            title={
              <div className="flex items-center gap-2">
                {t("prompts.title")}
                {dirtySections.prompts && <UnsavedChangesChip />}
              </div>
            }
          >
            <PromptsForm onDirtyChange={updateDirtySection("prompts")} />
          </AccordionItem>

          <AccordionItem
            key="bulkCategorization"
            subtitle={t("bulkCategorization.subtitle")}
            title={<div className="flex items-center gap-2">{t("bulkCategorization.title")}</div>}
          >
            <BulkCategorizationForm />
          </AccordionItem>
        </Accordion>
      </CardBody>
    </Card>
  );
}
