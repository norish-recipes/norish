"use client";

import { useState, useEffect } from "react";
import { Textarea, Button, Spinner } from "@heroui/react";
import { ArrowPathIcon, CheckIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useAdminSettingsContext } from "../context";

import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

export default function PromptsForm() {
  const t = useTranslations("settings.admin.promptsConfig");
  const tActions = useTranslations("common.actions");
  const { prompts, isLoading, updatePrompts, restoreDefaultConfig } = useAdminSettingsContext();

  const [recipeExtraction, setRecipeExtraction] = useState("");
  const [unitConversion, setUnitConversion] = useState("");
  const [nutritionEstimation, setNutritionEstimation] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize from context
  useEffect(() => {
    if (prompts) {
      setRecipeExtraction(prompts.recipeExtraction);
      setUnitConversion(prompts.unitConversion);
      setNutritionEstimation(prompts.nutritionEstimation);
    }
  }, [prompts]);

  // Track changes
  useEffect(() => {
    if (prompts) {
      const changed =
        recipeExtraction !== prompts.recipeExtraction ||
        unitConversion !== prompts.unitConversion ||
        nutritionEstimation !== prompts.nutritionEstimation;

      setHasChanges(changed);
    }
  }, [recipeExtraction, unitConversion, nutritionEstimation, prompts]);

  const handleSave = async () => {
    setSaving(true);
    await updatePrompts({
      recipeExtraction,
      unitConversion,
      nutritionEstimation,
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
        <Textarea
          description={t("recipeExtractionDescription")}
          label={t("recipeExtraction")}
          maxRows={15}
          minRows={6}
          placeholder={t("recipeExtractionPlaceholder")}
          value={recipeExtraction}
          onValueChange={setRecipeExtraction}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Textarea
          description={t("unitConversionDescription")}
          label={t("unitConversion")}
          maxRows={10}
          minRows={4}
          placeholder={t("unitConversionPlaceholder")}
          value={unitConversion}
          onValueChange={setUnitConversion}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Textarea
          description={t("nutritionEstimationDescription")}
          label={t("nutritionEstimation")}
          maxRows={15}
          minRows={6}
          placeholder={t("nutritionEstimationPlaceholder")}
          value={nutritionEstimation}
          onValueChange={setNutritionEstimation}
        />
      </div>

      <div className="flex items-center justify-between">
        <Button
          color="warning"
          isLoading={restoring}
          startContent={!restoring && <ArrowPathIcon className="h-5 w-5" />}
          variant="flat"
          onPress={handleRestoreDefaults}
        >
          {tActions("restoreDefaults")}
        </Button>
        <Button
          color="primary"
          isDisabled={!hasChanges}
          isLoading={saving}
          startContent={<CheckIcon className="h-5 w-5" />}
          onPress={handleSave}
        >
          {tActions("save")}
        </Button>
      </div>
    </div>
  );
}
