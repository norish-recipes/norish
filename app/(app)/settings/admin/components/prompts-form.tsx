"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Textarea, Select, SelectItem, Chip, Spinner } from "@heroui/react";
import { CheckIcon, ArrowPathIcon } from "@heroicons/react/16/solid";

import { useAdminSettingsContext } from "../context";

type PromptName = "recipe-extraction" | "unit-conversion";

const PROMPT_LABELS: Record<PromptName, string> = {
  "recipe-extraction": "Recipe Extraction",
  "unit-conversion": "Unit Conversion",
};

const PROMPT_DESCRIPTIONS: Record<PromptName, string> = {
  "recipe-extraction":
    "This prompt is used to extract recipe data from webpage content and convert it to structured JSON.",
  "unit-conversion":
    "This prompt is used to convert recipe measurements between metric and US systems.",
};

export default function PromptsForm() {
  const [selectedPrompt, setSelectedPrompt] = useState<PromptName>("recipe-extraction");
  const [content, setContent] = useState("");
  const [defaultContent, setDefaultContent] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { getPrompt, updatePrompt, resetPrompt, refresh } = useAdminSettingsContext();

  const loadPrompt = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPrompt(selectedPrompt);

      setContent(data.content);
      setDefaultContent(data.defaultContent);
      setIsCustom(data.isCustom);
    } finally {
      setIsLoading(false);
    }
  }, [getPrompt, selectedPrompt]);

  useEffect(() => {
    loadPrompt();
  }, [loadPrompt]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (content === defaultContent) {
        // If content matches default, reset instead of saving
        await resetPrompt(selectedPrompt);
      } else {
        await updatePrompt(selectedPrompt, content);
      }
      refresh();
      await loadPrompt();
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetPrompt(selectedPrompt);
      refresh();
      await loadPrompt();
    } finally {
      setIsResetting(false);
    }
  };

  const hasChanges = content !== (isLoading ? "" : defaultContent) && content !== defaultContent;
  const isDefault = content === defaultContent;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex items-center justify-between gap-4">
        <Select
          className="max-w-xs"
          label="Select Prompt"
          selectedKeys={[selectedPrompt]}
          onSelectionChange={(keys) => setSelectedPrompt(Array.from(keys)[0] as PromptName)}
        >
          <SelectItem key="recipe-extraction">{PROMPT_LABELS["recipe-extraction"]}</SelectItem>
          <SelectItem key="unit-conversion">{PROMPT_LABELS["unit-conversion"]}</SelectItem>
        </Select>

        {isCustom && (
          <Chip color="primary" size="sm" variant="flat">
            Custom
          </Chip>
        )}
      </div>

      <div className="text-default-500 text-sm">{PROMPT_DESCRIPTIONS[selectedPrompt]}</div>

      <Textarea
        classNames={{
          input: "font-mono text-sm",
        }}
        isDisabled={isLoading}
        label="Prompt Content"
        maxRows={20}
        minRows={10}
        placeholder="Enter prompt content..."
        value={content}
        onValueChange={setContent}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="text-default-500 text-xs">
          {isDefault ? "Using default prompt" : "Modified from default"}
        </div>

        <div className="flex gap-2">
          {!isDefault && (
            <Button
              isDisabled={isLoading || isSaving}
              isLoading={isResetting}
              startContent={<ArrowPathIcon className="h-4 w-4" />}
              variant="flat"
              onPress={handleReset}
            >
              Reset to Default
            </Button>
          )}

          <Button
            color="primary"
            isDisabled={!hasChanges || isLoading || isResetting}
            isLoading={isSaving}
            startContent={<CheckIcon className="h-4 w-4" />}
            onPress={handleSave}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
