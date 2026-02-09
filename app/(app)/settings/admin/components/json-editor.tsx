"use client";

import { useState, useEffect, useCallback } from "react";
import { Textarea, Button } from "@heroui/react";
import { ArrowPathIcon, CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

interface JsonEditorProps {
  value: unknown;
  label?: string;
  description: string;
  onSave: (jsonString: string) => Promise<{ success: boolean; error?: string }>;
  onRestoreDefaults?: () => Promise<{ success: boolean; error?: string }>;
  disabled?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

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
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Initialize text when value changes
  useEffect(() => {
    if (value !== undefined) {
      setText(JSON.stringify(value, null, 2));
      setIsDirty(false);
      setError(null);
    }
  }, [value]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleTextChange = useCallback(
    (newText: string) => {
      setText(newText);
      setIsDirty(true);

      // Validate JSON on change
      try {
        JSON.parse(newText);
        setError(null);
      } catch (_e) {
        setError(t("invalidJson"));
      }
    },
    [t]
  );

  const handleSave = useCallback(async () => {
    if (error) return;

    setSaving(true);
    try {
      const result = await onSave(text);

      if (result.success) {
        setIsDirty(false);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedToSave"));
    } finally {
      setSaving(false);
    }
  }, [text, error, onSave, t]);

  const handleRestoreDefaults = useCallback(async () => {
    if (!onRestoreDefaults) return;

    setSaving(true);
    try {
      const result = await onRestoreDefaults();

      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("failedToRestore"));
    } finally {
      setSaving(false);
    }
  }, [onRestoreDefaults, t]);

  const handleFormat = useCallback(() => {
    try {
      const parsed = JSON.parse(text);

      setText(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch {
      // Keep error state
    }
  }, [text]);

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
        </div>
      )}

      {description && <p className="text-default-500 text-base">{description}</p>}

      <Textarea
        classNames={{
          input: "font-mono text-sm",
        }}
        errorMessage={error || undefined}
        isDisabled={disabled}
        isInvalid={!!error && text !== ""}
        minRows={10}
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

      <div className="flex items-center justify-end gap-2">
        <Button
          className="hidden sm:inline-flex"
          isDisabled={disabled || saving}
          variant="flat"
          onPress={handleFormat}
        >
          {tActions("format")}
        </Button>

        {onRestoreDefaults && (
          <Button
            color="warning"
            isDisabled={disabled || saving}
            startContent={<ArrowPathIcon className="h-5 w-5" />}
            variant="flat"
            onPress={handleRestoreDefaults}
          >
            {tActions("restoreDefaults")}
          </Button>
        )}

        <Button
          color="primary"
          isDisabled={disabled || !!error || !isDirty}
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
