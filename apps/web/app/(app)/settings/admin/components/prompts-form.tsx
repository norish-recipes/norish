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
  const [recipeProvenance, setRecipeProvenance] = useState("");
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
      // Config stored before Recipe Provenance shipped has no prompt; the
      // loader falls back to the shipped file until an administrator saves one.
      setRecipeProvenance(prompts.recipeProvenance ?? "");
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
        recipeProvenance !== (prompts.recipeProvenance ?? "");

      setHasChanges(changed);
    }
  }, [
    recipeExtraction,
    unitConversion,
    nutritionEstimation,
    autoTagging,
    recipeProvenance,
    prompts,
  ]);
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
      recipeProvenance,
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
          <TextArea placeholder={t("recipeExtractionPlaceholder")} rows={6} variant="secondary" />
          <Description>{t("recipeExtractionDescription")}</Description>
        </TextField>
      </div>

      <div className="flex flex-col gap-2">
        <TextField value={unitConversion} onChange={setUnitConversion}>
          <Label>{t("unitConversion")}</Label>
          <TextArea placeholder={t("unitConversionPlaceholder")} rows={4} variant="secondary" />
          <Description>{t("unitConversionDescription")}</Description>
        </TextField>
      </div>

      <div className="flex flex-col gap-2">
        <TextField value={nutritionEstimation} onChange={setNutritionEstimation}>
          <Label>{t("nutritionEstimation")}</Label>
          <TextArea
            placeholder={t("nutritionEstimationPlaceholder")}
            rows={6}
            variant="secondary"
          />
          <Description>{t("nutritionEstimationDescription")}</Description>
        </TextField>
      </div>

      <div className="flex flex-col gap-2">
        <TextField value={autoTagging} onChange={setAutoTagging}>
          <Label>{t("autoTagging")}</Label>
          <TextArea placeholder={t("autoTaggingPlaceholder")} rows={6} variant="secondary" />
          <Description>{t("autoTaggingDescription")}</Description>
        </TextField>
      </div>

      <div className="flex flex-col gap-2">
        <TextField value={recipeProvenance} onChange={setRecipeProvenance}>
          <Label>{t("recipeProvenance")}</Label>
          <TextArea placeholder={t("recipeProvenancePlaceholder")} rows={6} variant="secondary" />
          <Description>{t("recipeProvenanceDescription")}</Description>
        </TextField>
      </div>

      <div className="flex items-center justify-between">
        <Button isPending={restoring} variant="tertiary" onPress={handleRestoreDefaults}>
          {!restoring && <ArrowPathIcon className="h-5 w-5" />}
          {tActions("restoreDefaults")}
        </Button>
        <Button isDisabled={!hasChanges} isPending={saving} variant="primary" onPress={handleSave}>
          {<CheckIcon className="h-5 w-5" />}
          {tActions("save")}
        </Button>
      </div>
    </div>
  );
}
