"use client";

import { useEffect, useState } from "react";
import { ArrowPathIcon, CheckIcon } from "@heroicons/react/16/solid";
import { Button, Description, Label, Spinner, TextArea, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { useAdminSettingsContext } from "../context";

interface PromptsFormProps {
  onDirtyChange?: (isDirty: boolean) => void;
}
export default function PromptsForm({ onDirtyChange }: PromptsFormProps) {
  const t = useTranslations("settings.admin.promptsConfig");
  const tActions = useTranslations("common.actions");
  const { prompts, isLoading, updatePrompts, restoreDefaultConfig } = useAdminSettingsContext();
  const [recipeExtraction, setRecipeExtraction] = useState("");
  const [unitConversion, setUnitConversion] = useState("");
  const [nutritionEstimation, setNutritionEstimation] = useState("");
  const [autoTagging, setAutoTagging] = useState("");
  const [provenanceInference, setProvenanceInference] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize from context
  useEffect(() => {
    if (prompts) {
      setRecipeExtraction(prompts.recipeExtraction);
      setUnitConversion(prompts.unitConversion);
      setNutritionEstimation(prompts.nutritionEstimation);
      setAutoTagging(prompts.autoTagging);
      setProvenanceInference(prompts.provenanceInference ?? "");
    }
  }, [prompts]);

  // Track changes
  useEffect(() => {
    if (prompts) {
      const changed =
        recipeExtraction !== prompts.recipeExtraction ||
        unitConversion !== prompts.unitConversion ||
        nutritionEstimation !== prompts.nutritionEstimation ||
        autoTagging !== prompts.autoTagging ||
        provenanceInference !== (prompts.provenanceInference ?? "");

      setHasChanges(changed);
    }
  }, [recipeExtraction, unitConversion, nutritionEstimation, autoTagging, provenanceInference, prompts]);
  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);
  const handleSave = async () => {
    setSaving(true);
    await updatePrompts({
      recipeExtraction,
      unitConversion,
      nutritionEstimation,
      autoTagging,
      provenanceInference,
    }).finally(() => {
      setSaving(false);
    });
  };
  const handleRestoreDefaults = async () => {
    setRestoring(true);
    await restoreDefaultConfig(ServerConfigKeys.PROMPTS).finally(() => {
      setRestoring(false);
    });
  };
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6 p-2">
      <div className="flex flex-col gap-2">
        <TextField value={recipeExtraction} onChange={setRecipeExtraction}>
          <Label>{t("recipeExtraction")}</Label>
          <TextArea
            variant="secondary"
            maxRows={15}
            minRows={6}
            placeholder={t("recipeExtractionPlaceholder")}
          />
          <Description>{t("recipeExtractionDescription")}</Description>
        </TextField>
      </div>

      <div className="flex flex-col gap-2">
        <TextField value={unitConversion} onChange={setUnitConversion}>
          <Label>{t("unitConversion")}</Label>
          <TextArea
            variant="secondary"
            maxRows={10}
            minRows={4}
            placeholder={t("unitConversionPlaceholder")}
          />
          <Description>{t("unitConversionDescription")}</Description>
        </TextField>
      </div>

      <div className="flex flex-col gap-2">
        <TextField value={nutritionEstimation} onChange={setNutritionEstimation}>
          <Label>{t("nutritionEstimation")}</Label>
          <TextArea
            variant="secondary"
            maxRows={15}
            minRows={6}
            placeholder={t("nutritionEstimationPlaceholder")}
          />
          <Description>{t("nutritionEstimationDescription")}</Description>
        </TextField>
      </div>

      <div className="flex flex-col gap-2">
        <TextField value={autoTagging} onChange={setAutoTagging}>
          <Label>{t("autoTagging")}</Label>
          <TextArea
            variant="secondary"
            maxRows={15}
            minRows={6}
            placeholder={t("autoTaggingPlaceholder")}
          />
          <Description>{t("autoTaggingDescription")}</Description>
        </TextField>
      </div>

      <div className="flex flex-col gap-2">
        <TextField value={provenanceInference} onChange={setProvenanceInference}>
          <Label>{t("provenanceInference", { fallback: "Provenance Inference Prompt" })}</Label>
          <TextArea
            variant="secondary"
            maxRows={15}
            minRows={6}
            placeholder={t("provenanceInferencePlaceholder", { fallback: "Enter provenance inference prompt here..." })}
          />
          <Description>{t("provenanceInferenceDescription", { fallback: "Prompt used to Infer Provenance from its title and ingredients." })}</Description>
        </TextField>
      </div>

      <div className="flex items-center justify-between">
        <Button onPress={handleRestoreDefaults} variant="tertiary" isPending={restoring}>
          {!restoring && <ArrowPathIcon className="h-5 w-5" />}
          {tActions("restoreDefaults")}
        </Button>
        <Button isDisabled={!hasChanges} onPress={handleSave} variant="primary" isPending={saving}>
          {<CheckIcon className="h-5 w-5" />}
          {tActions("save")}
        </Button>
      </div>
    </div>
  );
}
