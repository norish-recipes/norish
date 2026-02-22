"use client";

import { useState, useEffect, useCallback } from "react";
import { Textarea, Button, Switch } from "@heroui/react";
import { ArrowPathIcon, CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

interface TimerKeywordsEditorProps {
  enabled: boolean;
  hours: string[];
  minutes: string[];
  seconds: string[];
  onUpdate: (config: {
    enabled: boolean;
    hours: string[];
    minutes: string[];
    seconds: string[];
  }) => Promise<{ success: boolean; error?: string }>;
  onRestoreDefaults: () => Promise<{ success: boolean; error?: string }>;
  onDirtyChange?: (isDirty: boolean) => void;
}

export default function TimerKeywordsEditor({
  enabled,
  hours,
  minutes,
  seconds,
  onUpdate,
  onRestoreDefaults,
  onDirtyChange,
}: TimerKeywordsEditorProps) {
  const t = useTranslations("settings.admin.contentDetection.timerKeywords");
  const tActions = useTranslations("common.actions");

  const [isEnabled, setIsEnabled] = useState(enabled);
  const [hoursText, setHoursText] = useState("");
  const [minutesText, setMinutesText] = useState("");
  const [secondsText, setSecondsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Initialize text when keywords change
  useEffect(() => {
    setHoursText(hours.join(", "));
    setMinutesText(minutes.join(", "));
    setSecondsText(seconds.join(", "));
    setIsEnabled(enabled);
    setIsDirty(false);
    setError(null);
  }, [enabled, hours, minutes, seconds]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleEnabledChange = useCallback((newEnabled: boolean) => {
    setIsEnabled(newEnabled);
    setIsDirty(true);
  }, []);

  const handleTextChange = useCallback(
    (field: "hours" | "minutes" | "seconds", newText: string) => {
      if (field === "hours") setHoursText(newText);
      if (field === "minutes") setMinutesText(newText);
      if (field === "seconds") setSecondsText(newText);
      setIsDirty(true);
      setError(null);

      // Validation: at least one keyword in one category when enabled
      if (isEnabled) {
        const hasHours = field === "hours" ? newText.trim() !== "" : hoursText.trim() !== "";
        const hasMinutes = field === "minutes" ? newText.trim() !== "" : minutesText.trim() !== "";
        const hasSeconds = field === "seconds" ? newText.trim() !== "" : secondsText.trim() !== "";

        if (!hasHours && !hasMinutes && !hasSeconds) {
          setError("At least one keyword required in hours, minutes, or seconds");
        }
      }
    },
    [isEnabled, hoursText, minutesText, secondsText]
  );

  const handleSave = useCallback(async () => {
    if (error) return;

    // Parse comma-separated keywords
    const parsedHours = hoursText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    const parsedMinutes = minutesText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    const parsedSeconds = secondsText
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    // Validation: at least one keyword in one category when enabled
    if (
      isEnabled &&
      parsedHours.length === 0 &&
      parsedMinutes.length === 0 &&
      parsedSeconds.length === 0
    ) {
      setError("At least one keyword required in hours, minutes, or seconds");

      return;
    }

    setSaving(true);
    try {
      const result = await onUpdate({
        enabled: isEnabled,
        hours: parsedHours,
        minutes: parsedMinutes,
        seconds: parsedSeconds,
      });

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
  }, [hoursText, minutesText, secondsText, isEnabled, error, onUpdate]);

  const handleRestoreDefaults = useCallback(async () => {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{t("enableToggle")}</span>
        <Switch isSelected={isEnabled} onValueChange={handleEnabledChange} />
      </div>

      <p className="text-default-500 text-sm">{t("description")}</p>

      {/* Hours Field */}
      <Textarea
        classNames={{
          input: "font-mono text-sm",
        }}
        description={t("hoursHelp")}
        isDisabled={!isEnabled || saving}
        label={t("hoursLabel")}
        minRows={2}
        placeholder={t("hoursPlaceholder")}
        value={hoursText}
        onChange={(e) => handleTextChange("hours", e.target.value)}
      />

      {/* Minutes Field */}
      <Textarea
        classNames={{
          input: "font-mono text-sm",
        }}
        description={t("minutesHelp")}
        isDisabled={!isEnabled || saving}
        label={t("minutesLabel")}
        minRows={2}
        placeholder={t("minutesPlaceholder")}
        value={minutesText}
        onChange={(e) => handleTextChange("minutes", e.target.value)}
      />

      {/* Seconds Field */}
      <Textarea
        classNames={{
          input: "font-mono text-sm",
        }}
        description={t("secondsHelp")}
        isDisabled={!isEnabled || saving}
        label={t("secondsLabel")}
        minRows={2}
        placeholder={t("secondsPlaceholder")}
        value={secondsText}
        onChange={(e) => handleTextChange("seconds", e.target.value)}
      />

      {error && (
        <div className="text-danger flex items-center gap-2 text-sm">
          <ExclamationTriangleIcon className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          color="warning"
          isDisabled={saving}
          startContent={<ArrowPathIcon className="h-5 w-5" />}
          variant="flat"
          onPress={handleRestoreDefaults}
        >
          {tActions("restoreDefaults")}
        </Button>

        <Button
          color="primary"
          isDisabled={!!error || !isDirty}
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
