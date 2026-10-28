"use client";

import { useEffect, useState } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Description, Label, TextArea, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PromptsConfig } from "@norish/config/zod/server-config";
import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { useAdminSettingsContext } from "../context";

/**
 * Every administrator-editable prompt, one entry each. Adding a prompt is one
 * row here (plus its three translation keys), not a hand-written state hook,
 * load line, dirty clause, submit key and form block.
 */
const PROMPT_FIELDS = [
  { key: "recipeExtraction", rows: 6 },
  { key: "imageExtraction", rows: 6 },
  { key: "unitConversion", rows: 4 },
  { key: "nutritionEstimation", rows: 6 },
  { key: "autoTagging", rows: 6 },
  { key: "autoCategorization", rows: 6 },
  { key: "allergyDetection", rows: 6 },
  { key: "recipeProvenance", rows: 6 },
  { key: "ingredientLinking", rows: 6 },
  { key: "ingredientResolution", rows: 6 },
  { key: "ingredientMatch", rows: 6 },
  { key: "imageGenerationBrief", rows: 6 },
  { key: "imageGenerationStyle", rows: 4 },
  { key: "ingredientIconStyle", rows: 4 },
  { key: "ingredientPlainName", rows: 8 },
  { key: "ingredientSpellingCheck", rows: 8 },
  { key: "ingredientNutrition", rows: 8 },
] as const satisfies readonly { key: keyof PromptsConfig; rows: number }[];

type PromptKey = (typeof PROMPT_FIELDS)[number]["key"];

type PromptValues = Record<PromptKey, string>;

const EMPTY_VALUES: PromptValues = Object.fromEntries(
  PROMPT_FIELDS.map(({ key }) => [key, ""])
) as PromptValues;

interface PromptsFormProps {
  onDirtyChange?: (isDirty: boolean) => void;
}
export default function PromptsForm({ onDirtyChange }: PromptsFormProps) {
  const t = useTranslations("settings.admin.promptsConfig");
  const tActions = useTranslations("common.actions");
  const { prompts, updatePrompts, restoreDefaultConfig } = useAdminSettingsContext();
  const [values, setValues] = useState<PromptValues>(EMPTY_VALUES);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Starts unset so prompts present on the first render seed the form too.
  const [prevPrompts, setPrevPrompts] = useState<typeof prompts>();

  // Initialize from context. A prompt added after the stored config was
  // written has no stored value; the loader falls back to the shipped file
  // until an administrator saves one.
  if (prompts !== prevPrompts) {
    setPrevPrompts(prompts);
    if (prompts) {
      setValues(
        Object.fromEntries(
          PROMPT_FIELDS.map(({ key }) => [key, prompts[key] ?? ""])
        ) as PromptValues
      );
    }
  }

  // Track changes
  const hasChanges =
    !!prompts && PROMPT_FIELDS.some(({ key }) => values[key] !== (prompts[key] ?? ""));

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);
  const handleSave = async () => {
    setSaving(true);
    await updatePrompts(values).finally(() => {
      setSaving(false);
    });
  };
  const handleRestoreDefaults = async () => {
    setRestoring(true);
    await restoreDefaultConfig(ServerConfigKeys.PROMPTS).finally(() => {
      setRestoring(false);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {PROMPT_FIELDS.map(({ key, rows }) => (
        <div key={key} className="flex flex-col gap-2">
          <TextField
            value={values[key]}
            onChange={(value) => setValues((prev) => ({ ...prev, [key]: value }))}
          >
            <Label>{t(key)}</Label>
            <TextArea placeholder={t(`${key}Placeholder`)} rows={rows} variant="secondary" />
            <Description>{t(`${key}Description`)}</Description>
          </TextField>
        </div>
      ))}

      <ActionButtonGroup>
        <ActionButton action="reset" isPending={restoring} onPress={handleRestoreDefaults}>
          {tActions("reset")}
        </ActionButton>
        <ActionButton
          action="save"
          isDisabled={!hasChanges}
          isPending={saving}
          onPress={handleSave}
        >
          {tActions("save")}
        </ActionButton>
      </ActionButtonGroup>
    </div>
  );
}
