"use client";

import { useEffect, useState } from "react";
import { ArrowPathIcon, CheckIcon } from "@heroicons/react/16/solid";
import { Button, Description, Label, Spinner, TextArea, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { PromptsConfigInput } from "@norish/config/zod/server-config";
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
] as const satisfies readonly { key: keyof PromptsConfigInput; rows: number }[];

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
  const { prompts, isLoading, updatePrompts, restoreDefaultConfig } = useAdminSettingsContext();
  const [values, setValues] = useState<PromptValues>(EMPTY_VALUES);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize from context. A prompt added after the stored config was
  // written has no stored value; the loader falls back to the shipped file
  // until an administrator saves one.
  useEffect(() => {
    if (prompts) {
      setValues(
        Object.fromEntries(
          PROMPT_FIELDS.map(({ key }) => [key, prompts[key] ?? ""])
        ) as PromptValues
      );
    }
  }, [prompts]);

  // Track changes
  useEffect(() => {
    if (prompts) {
      setHasChanges(PROMPT_FIELDS.some(({ key }) => values[key] !== (prompts[key] ?? "")));
    }
  }, [values, prompts]);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-2">
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
