"use client";

import { SettingsAccordion, SettingsCard } from "@/components/settings/settings-card";
import { Note } from "@/components/shared/note";
import { useAIKeyRejections } from "@/hooks/use-ai-key-rejections";
import { SparklesIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";

import { AccordionSection } from "../accordion-section";
import IngredientCatalogueForm from "../catalogue/ingredient-catalogue-form";
import AIConfigForm from "./ai-config-form";
import BulkEnrichmentForm from "./bulk-enrichment-form";
import CuisineVocabularyForm from "./cuisine-vocabulary-form";
import DecisionModelForm from "./decision-model-form";
import ImageGenerationForm from "./image-generation-form";
import PromptsForm from "./prompts-form";
import VideoProcessingForm from "./video-processing-form";

export default function AIProcessingCard() {
  const t = useTranslations("settings.admin.aiProcessing");
  const keyRejections = useAIKeyRejections();

  return (
    <SettingsCard description={t("description")} icon={SparklesIcon} title={t("title")}>
      {keyRejections && (
        <Note status="danger" title={keyRejections.title}>
          {keyRejections.description}
        </Note>
      )}
      <SettingsAccordion>
        <AccordionSection id="ai" subtitle={t("aiConfig.subtitle")} title={t("aiConfig.title")}>
          {(onDirtyChange) => <AIConfigForm onDirtyChange={onDirtyChange} />}
        </AccordionSection>
        <AccordionSection id="video" subtitle={t("video.subtitle")} title={t("video.title")}>
          {(onDirtyChange) => <VideoProcessingForm onDirtyChange={onDirtyChange} />}
        </AccordionSection>
        <AccordionSection
          id="imageGeneration"
          subtitle={t("imageGeneration.subtitle")}
          title={t("imageGeneration.title")}
        >
          {(onDirtyChange) => <ImageGenerationForm onDirtyChange={onDirtyChange} />}
        </AccordionSection>
        <AccordionSection
          id="decisionModel"
          subtitle={t("decisionModel.subtitle")}
          title={t("decisionModel.title")}
        >
          {(onDirtyChange) => <DecisionModelForm onDirtyChange={onDirtyChange} />}
        </AccordionSection>
        <AccordionSection id="prompts" subtitle={t("prompts.subtitle")} title={t("prompts.title")}>
          {(onDirtyChange) => <PromptsForm onDirtyChange={onDirtyChange} />}
        </AccordionSection>
        <AccordionSection
          id="cuisines"
          subtitle={t("cuisines.subtitle")}
          title={t("cuisines.title")}
        >
          <CuisineVocabularyForm />
        </AccordionSection>
        <AccordionSection
          id="bulkEnrichment"
          subtitle={t("bulkEnrichment.subtitle")}
          title={t("bulkEnrichment.title")}
        >
          <BulkEnrichmentForm />
        </AccordionSection>
        <AccordionSection
          id="ingredientCatalogue"
          subtitle={t("ingredientCatalogue.subtitle")}
          title={t("ingredientCatalogue.title")}
        >
          {(onDirtyChange) => <IngredientCatalogueForm onDirtyChange={onDirtyChange} />}
        </AccordionSection>
      </SettingsAccordion>
    </SettingsCard>
  );
}
