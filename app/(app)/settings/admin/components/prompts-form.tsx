"use client";

import { useState, useEffect } from "react";
import { Textarea, Button, Spinner } from "@heroui/react";
import { ArrowPathIcon } from "@heroicons/react/16/solid";

import { useAdminSettingsContext } from "../context";

import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

export default function PromptsForm() {
  const { prompts, isLoading, updatePrompts, restoreDefaultConfig } = useAdminSettingsContext();

  const [recipeExtraction, setRecipeExtraction] = useState("");
  const [unitConversion, setUnitConversion] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize from context
  useEffect(() => {
    if (prompts) {
      setRecipeExtraction(prompts.recipeExtraction);
      setUnitConversion(prompts.unitConversion);
    }
  }, [prompts]);

  // Track changes
  useEffect(() => {
    if (prompts) {
      const changed =
        recipeExtraction !== prompts.recipeExtraction ||
        unitConversion !== prompts.unitConversion;

      setHasChanges(changed);
    }
  }, [recipeExtraction, unitConversion, prompts]);

  const handleSave = async () => {
    setSaving(true);
      await updatePrompts({
        recipeExtraction,
        unitConversion,
      }).finally(() => {
        setSaving(false);
      });
  };

  const handleRestoreDefaults = async () => {
    setRestoring(true);
    await restoreDefaultConfig(ServerConfigKeys.PROMPTS)
      .finally(() => {
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
        <label className="text-sm font-medium">Recipe Extraction Prompt</label>
        <p className="text-default-500 text-xs">
          This prompt is used when extracting recipe data from web pages or video transcripts.
        </p>
        <Textarea
          maxRows={15}
          minRows={6}
          placeholder="Enter the recipe extraction prompt..."
          value={recipeExtraction}
          onValueChange={setRecipeExtraction}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Unit Conversion Prompt</label>
        <p className="text-default-500 text-xs">
          This prompt is used when converting recipe measurements between metric and US systems.
          Available variables: {"{{sourceSystem}}"}, {"{{targetSystem}}"}, {"{{units}}"}
        </p>
        <Textarea
          maxRows={10}
          minRows={4}
          placeholder="Enter the unit conversion prompt..."
          value={unitConversion}
          onValueChange={setUnitConversion}
        />
      </div>

      <div className="flex items-center justify-between ">
        <Button
          color="warning"
          isLoading={restoring}
          startContent={!restoring && <ArrowPathIcon className="h-4 w-4" />}
          variant="flat"
          onPress={handleRestoreDefaults}
        >
          Restore Defaults
        </Button>
        <Button color="primary" isDisabled={!hasChanges} isLoading={saving} onPress={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
