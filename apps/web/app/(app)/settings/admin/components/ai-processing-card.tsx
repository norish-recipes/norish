"use client";

import { useCallback, useState } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { Accordion, Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import AIConfigForm from "./ai-config-form";
import BulkCategorizationForm from "./bulk-categorization-form";
import PromptsForm from "./prompts-form";
import { UnsavedChangesChip } from "./unsaved-changes-chip";
import VideoProcessingForm from "./video-processing-form";

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
      <Card.Header>
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
        </div>
      </Card.Header>
      <Card.Content>
        <p className="text-muted mb-4 text-base">{t("description")}</p>
        <Accordion allowsMultipleExpanded variant="surface">
          <Accordion.Item id="ai">
            <Accordion.Heading>
              <Accordion.Trigger>
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2">
                    {t("aiConfig.title")}
                    {dirtySections.ai && <UnsavedChangesChip />}
                  </div>
                  <span className="text-muted text-sm">{t("aiConfig.subtitle")}</span>
                </div>
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>
                <AIConfigForm onDirtyChange={updateDirtySection("ai")} />
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item id="video">
            <Accordion.Heading>
              <Accordion.Trigger>
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2">
                    {t("video.title")}
                    {dirtySections.video && <UnsavedChangesChip />}
                  </div>
                  <span className="text-muted text-sm">{t("video.subtitle")}</span>
                </div>
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>
                <VideoProcessingForm onDirtyChange={updateDirtySection("video")} />
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item id="prompts">
            <Accordion.Heading>
              <Accordion.Trigger>
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2">
                    {t("prompts.title")}
                    {dirtySections.prompts && <UnsavedChangesChip />}
                  </div>
                  <span className="text-muted text-sm">{t("prompts.subtitle")}</span>
                </div>
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>
                <PromptsForm onDirtyChange={updateDirtySection("prompts")} />
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item id="bulkCategorization">
            <Accordion.Heading>
              <Accordion.Trigger>
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-2">{t("bulkCategorization.title")}</div>
                  <span className="text-muted text-sm">{t("bulkCategorization.subtitle")}</span>
                </div>
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>
                <BulkCategorizationForm />
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Card.Content>
    </Card>
  );
}
