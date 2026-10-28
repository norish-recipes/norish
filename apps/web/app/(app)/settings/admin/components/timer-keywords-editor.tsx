"use client";

import { useCallback, useEffect, useState } from "react";
import { SwitchRow } from "@/app/(app)/settings/components/setting-row";
import SettingsSwitch from "@/app/(app)/settings/components/settings-switch";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { usePending } from "@/hooks/use-pending";
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { Description, Label, TextArea, TextField } from "@heroui/react";
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
  }) => Promise<{
    success: boolean;
    error?: string;
  }>;
  onRestoreDefaults: () => Promise<{
    success: boolean;
    error?: string;
  }>;
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
  const [hoursText, setHoursText] = useState(() => hours.join(", "));
  const [minutesText, setMinutesText] = useState(() => minutes.join(", "));
  const [secondsText, setSecondsText] = useState(() => seconds.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [saving, whileSaving] = usePending();
  const [isDirty, setIsDirty] = useState(false);
  const [prevKeywords, setPrevKeywords] = useState({ enabled, hours, minutes, seconds });

  // Initialize text when keywords change
  if (
    enabled !== prevKeywords.enabled ||
    hours !== prevKeywords.hours ||
    minutes !== prevKeywords.minutes ||
    seconds !== prevKeywords.seconds
  ) {
    setPrevKeywords({ enabled, hours, minutes, seconds });
    setHoursText(hours.join(", "));
    setMinutesText(minutes.join(", "));
    setSecondsText(seconds.join(", "));
    setIsEnabled(enabled);
    setIsDirty(false);
    setError(null);
  }
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
    await whileSaving(() =>
      onUpdate({
        enabled: isEnabled,
        hours: parsedHours,
        minutes: parsedMinutes,
        seconds: parsedSeconds,
      })
        .then((result) => {
          if (result.success) {
            setIsDirty(false);
          } else if (result.error) {
            setError(result.error);
          }
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to save"))
    );
  }, [hoursText, minutesText, secondsText, isEnabled, error, onUpdate, whileSaving]);
  const handleRestoreDefaults = useCallback(async () => {
    await whileSaving(() =>
      onRestoreDefaults()
        .then((result) => {
          if (!result.success && result.error) {
            setError(result.error);
          }
        })
        .catch((e: unknown) =>
          setError(e instanceof Error ? e.message : "Failed to restore defaults")
        )
    );
  }, [onRestoreDefaults, whileSaving]);
  return (
    <div className="flex flex-col gap-4">
      <SwitchRow description={t("description")} title={t("enableToggle")}>
        <SettingsSwitch isSelected={isEnabled} onValueChange={handleEnabledChange} />
      </SwitchRow>

      {/* Hours Field */}
      <TextField
        isDisabled={!isEnabled || saving}
        value={hoursText}
        onChange={(value) => handleTextChange("hours", value)}
      >
        <Label>{t("hoursLabel")}</Label>
        <TextArea
          variant="secondary"
          className="font-mono text-sm"
          rows={2}
          placeholder={t("hoursPlaceholder")}
        />
        <Description>{t("hoursHelp")}</Description>
      </TextField>

      {/* Minutes Field */}
      <TextField
        isDisabled={!isEnabled || saving}
        value={minutesText}
        onChange={(value) => handleTextChange("minutes", value)}
      >
        <Label>{t("minutesLabel")}</Label>
        <TextArea
          variant="secondary"
          className="font-mono text-sm"
          rows={2}
          placeholder={t("minutesPlaceholder")}
        />
        <Description>{t("minutesHelp")}</Description>
      </TextField>

      {/* Seconds Field */}
      <TextField
        isDisabled={!isEnabled || saving}
        value={secondsText}
        onChange={(value) => handleTextChange("seconds", value)}
      >
        <Label>{t("secondsLabel")}</Label>
        <TextArea
          variant="secondary"
          className="font-mono text-sm"
          rows={2}
          placeholder={t("secondsPlaceholder")}
        />
        <Description>{t("secondsHelp")}</Description>
      </TextField>

      {error && (
        <div className="text-danger flex items-center gap-2 text-sm">
          <ExclamationTriangleIcon className="h-4 w-4" />
          {error}
        </div>
      )}

      <ActionButtonGroup>
        <ActionButton action="reset" isDisabled={saving} onPress={handleRestoreDefaults}>
          {tActions("restoreDefaults")}
        </ActionButton>
        <ActionButton
          action="save"
          isDisabled={!!error || !isDirty}
          isPending={saving}
          onPress={handleSave}
        >
          {tActions("save")}
        </ActionButton>
      </ActionButtonGroup>
    </div>
  );
}
