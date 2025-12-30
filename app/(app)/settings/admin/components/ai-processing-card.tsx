"use client";

import { Card, CardBody, CardHeader, Accordion, AccordionItem } from "@heroui/react";
import { SparklesIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import AIConfigForm from "./ai-config-form";
import VideoProcessingForm from "./video-processing-form";
import PromptsForm from "./prompts-form";

export default function AIProcessingCard() {
  const t = useTranslations("settings.admin.aiProcessing");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
        </div>
      </CardHeader>
      <CardBody>
        <p className="text-default-500 mb-4 text-base">
          {t("description")}
        </p>
        <Accordion selectionMode="multiple" variant="bordered">
          <AccordionItem
            key="ai"
            subtitle={t("aiConfig.subtitle")}
            title={<div className="flex items-center gap-2">{t("aiConfig.title")}</div>}
          >
            <AIConfigForm />
          </AccordionItem>

          <AccordionItem
            key="video"
            subtitle={t("video.subtitle")}
            title={<div className="flex items-center gap-2">{t("video.title")}</div>}
          >
            <VideoProcessingForm />
          </AccordionItem>

          <AccordionItem
            key="prompts"
            subtitle={t("prompts.subtitle")}
            title={<div className="flex items-center gap-2">{t("prompts.title")}</div>}
          >
            <PromptsForm />
          </AccordionItem>
        </Accordion>
      </CardBody>
    </Card>
  );
}
