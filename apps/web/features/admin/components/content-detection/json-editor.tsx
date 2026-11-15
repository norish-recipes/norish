"use client";

import { useState } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { CodeBracketIcon, ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { TextArea } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { WriteResult } from "@norish/shared-react/admin";

import { useEditorWrites } from "../../hooks/use-editor-writes";
import { useReportDirty } from "../../hooks/use-report-dirty";

interface JsonEditorProps {
  value: unknown;
  label?: string;
  description: string;
  onSave: (jsonString: string) => Promise<WriteResult | null>;
  onRestoreDefaults?: () => Promise<WriteResult | null>;
  disabled?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}
const toText = (value: unknown) => (value === undefined ? "" : JSON.stringify(value, null, 2));

export default function JsonEditor({
  value,
  onSave,
  onRestoreDefaults,
  label,
  description,
  disabled = false,
  onDirtyChange,
}: JsonEditorProps) {
  const t = useTranslations("settings.admin.jsonEditor");
  const tActions = useTranslations("common.actions");
  const [text, setText] = useState(() => toText(value));
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const { saving, save, restore } = useEditorWrites(setError, () => setIsDirty(false));
  const [prevValue, setPrevValue] = useState(value);

  // Initialize text when value changes
  if (value !== prevValue) {
    setPrevValue(value);
    setText(toText(value));
    setIsDirty(false);
    setError(null);
  }
  useReportDirty(isDirty, onDirtyChange);
  const handleTextChange = (newText: string) => {
    setText(newText);
    setIsDirty(true);

    // Validate JSON on change
    try {
      JSON.parse(newText);
      setError(null);
    } catch (_e) {
      setError(t("invalidJson"));
    }
  };
  const handleSave = async () => {
    if (error) return;
    await save(() => onSave(text));
  };
  const handleRestoreDefaults = async () => {
    if (!onRestoreDefaults) return;
    await restore(onRestoreDefaults);
  };
  const handleFormat = () => {
    try {
      const parsed = JSON.parse(text);
      setText(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch {
      // Keep error state
    }
  };
  return (
    <div className="flex flex-col gap-3">
      {label && (
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
        </div>
      )}

      {description && <p className="text-muted text-base">{description}</p>}

      <TextArea
        variant="secondary"
        className="font-mono text-sm"
        aria-invalid={!!error && text !== ""}
        disabled={disabled}
        rows={10}
        placeholder={t("placeholder")}
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
      />

      {error && (
        <div className="text-danger flex items-center gap-2 text-base">
          <ExclamationTriangleIcon className="h-4 w-4" />
          {error}
        </div>
      )}

      <ActionButtonGroup>
        <ActionButton
          action="edit"
          className="hidden sm:inline-flex"
          icon={CodeBracketIcon}
          isDisabled={disabled || saving}
          onPress={handleFormat}
        >
          {tActions("format")}
        </ActionButton>

        {onRestoreDefaults && (
          <ActionButton action="reset" isDisabled={saving} onPress={handleRestoreDefaults}>
            {tActions("reset")}
          </ActionButton>
        )}

        <ActionButton
          action="save"
          isDisabled={disabled || !!error || !isDirty}
          isPending={saving}
          onPress={handleSave}
        >
          {tActions("save")}
        </ActionButton>
      </ActionButtonGroup>
    </div>
  );
}
