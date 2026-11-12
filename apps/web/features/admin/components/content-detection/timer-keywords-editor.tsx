"use client";

import { useState } from "react";
import { SwitchRow } from "@/components/settings/setting-row";
import SettingsSwitch from "@/components/settings/settings-switch";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import { Description, Label, TextArea, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { WriteResult } from "@norish/shared-react/admin";

import { useReportDirty } from "../use-report-dirty";
import { useEditorWrites } from "./use-editor-writes";

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
  }) => Promise<WriteResult | null>;
  onRestoreDefaults: () => Promise<WriteResult | null>;
  onDirtyChange?: (isDirty: boolean) => void;
}

/**
 * The keywords in a comma-separated list. An Arabic keyboard types its own
 * comma ("،"), so either one separates.
 */
export function splitKeywords(text: string): string[] {
  return text
    .split(/[,،]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
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
  const [isDirty, setIsDirty] = useState(false);
  const { saving, save, restore } = useEditorWrites(setError, () => setIsDirty(false));
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
  useReportDirty(isDirty, onDirtyChange);
  const handleEnabledChange = (newEnabled: boolean) => {
    setIsEnabled(newEnabled);
    setIsDirty(true);
  };
  const handleTextChange = (field: "hours" | "minutes" | "seconds", newText: string) => {
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
        setError(t("keywordRequired"));
      }
    }
  };
  const handleSave = async () => {
    if (error) return;

    const parsedHours = splitKeywords(hoursText);
    const parsedMinutes = splitKeywords(minutesText);
    const parsedSeconds = splitKeywords(secondsText);

    // Validation: at least one keyword in one category when enabled
    if (
      isEnabled &&
      parsedHours.length === 0 &&
      parsedMinutes.length === 0 &&
      parsedSeconds.length === 0
    ) {
      setError(t("keywordRequired"));
      return;
    }
    await save(() =>
      onUpdate({
        enabled: isEnabled,
        hours: parsedHours,
        minutes: parsedMinutes,
        seconds: parsedSeconds,
      })
    );
  };
  const handleRestoreDefaults = async () => {
    await restore(onRestoreDefaults);
  };
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
          {tActions("reset")}
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
