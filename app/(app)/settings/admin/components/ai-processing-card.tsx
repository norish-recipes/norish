"use client";

import { Card, CardBody, CardHeader, Accordion, AccordionItem } from "@heroui/react";
import { SparklesIcon } from "@heroicons/react/16/solid";

import AIConfigForm from "./ai-config-form";
import VideoProcessingForm from "./video-processing-form";
import PromptsForm from "./prompts-form";

export default function AIProcessingCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5" />
          <h2 className="text-lg font-semibold">AI & Processing</h2>
        </div>
      </CardHeader>
      <CardBody>
        <p className="text-default-500 mb-4 text-base">
          Configure AI-powered features for recipe extraction and video processing.
        </p>
        <Accordion selectionMode="multiple" variant="bordered">
          <AccordionItem
            key="ai"
            subtitle="Recipe parsing and extraction"
            title={<div className="flex items-center gap-2">AI Configuration</div>}
          >
            <AIConfigForm />
          </AccordionItem>

          <AccordionItem
            key="video"
            subtitle="Social media video extraction & transcription"
            title={<div className="flex items-center gap-2">Video Processing</div>}
          >
            <VideoProcessingForm />
          </AccordionItem>

          <AccordionItem
            key="prompts"
            subtitle="Customize AI instructions for recipe processing"
            title={<div className="flex items-center gap-2">Prompts</div>}
          >
            <PromptsForm />
          </AccordionItem>
        </Accordion>
      </CardBody>
    </Card>
  );
}
