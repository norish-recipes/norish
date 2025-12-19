"use client";

import { useState, useEffect, useCallback } from "react";
import { Textarea, Button, Chip } from "@heroui/react";
import { ArrowPathIcon, CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/16/solid";

interface JsonEditorProps {
  value: unknown;
  onSave: (json: string) => Promise<{ success: boolean; error?: string }>;
  onRestoreDefaults?: () => Promise<{ success: boolean; error?: string }>;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export default function JsonEditor({
  value,
  onSave,
  onRestoreDefaults,
  label,
  description,
  disabled = false,
}: JsonEditorProps) {
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

  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    setIsDirty(true);

    // Validate JSON on change
    try {
      JSON.parse(newText);
      setError(null);
    } catch (_e) {
      setError("Invalid JSON format");
    }
  }, []);

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
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [text, error, onSave]);

  const handleRestoreDefaults = useCallback(async () => {
    if (!onRestoreDefaults) return;

    setSaving(true);
    try {
      const result = await onRestoreDefaults();

      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to restore defaults");
    } finally {
      setSaving(false);
    }
  }, [onRestoreDefaults]);

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
          {isDirty && (
            <Chip color="warning" size="sm" variant="flat">
              Unsaved changes
            </Chip>
          )}
        </div>
      )}

      {description && <p className="text-default-500 text-base">{description}</p>}

      <Textarea
        classNames={{
          input: "font-mono text-sm",
          inputWrapper: error ? "border-danger" : "",
        }}
        isDisabled={disabled || saving}
        maxRows={20}
        minRows={8}
        placeholder="Enter JSON configuration..."
        value={text}
        onValueChange={handleTextChange}
      />

      {error && (
        <div className="text-danger flex items-center gap-2 text-base">
          <ExclamationTriangleIcon className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button isDisabled={disabled || saving} size="sm" variant="flat" onPress={handleFormat}>
            Format
          </Button>

          {onRestoreDefaults && (
            <Button
              color="warning"
              isDisabled={disabled || saving}
              size="sm"
              startContent={<ArrowPathIcon className="h-4 w-4" />}
              variant="flat"
              onPress={handleRestoreDefaults}
            >
              Restore Defaults
            </Button>
          )}
        </div>

        <Button
          color="primary"
          isDisabled={disabled || !!error || !isDirty}
          isLoading={saving}
          startContent={<CheckIcon className="h-4 w-4" />}
          onPress={handleSave}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
