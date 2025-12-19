"use client";

import { useState, useEffect, useCallback } from "react";
import { Input, Button, Switch, Select, SelectItem, Divider } from "@heroui/react";
import { CheckIcon } from "@heroicons/react/16/solid";

import { useAdminSettingsContext } from "../context";

import { ServerConfigKeys, type TranscriptionProvider } from "@/server/db/zodSchemas/server-config";
import SecretInput from "@/components/shared/secret-input";

export default function VideoProcessingForm() {
  const { videoConfig, updateVideoConfig, aiConfig, fetchConfigSecret } = useAdminSettingsContext();

  // Combined video + transcription config state
  const [enabled, setEnabled] = useState(videoConfig?.enabled ?? false);
  const [maxLengthSeconds, setMaxLengthSeconds] = useState(videoConfig?.maxLengthSeconds ?? 120);
  const [ytDlpVersion, setYtDlpVersion] = useState(videoConfig?.ytDlpVersion ?? "2025.11.12");
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider>(
    videoConfig?.transcriptionProvider ?? "disabled"
  );
  const [transcriptionEndpoint, setTranscriptionEndpoint] = useState(
    videoConfig?.transcriptionEndpoint ?? ""
  );
  const [transcriptionApiKey, setTranscriptionApiKey] = useState("");
  const [transcriptionModel, setTranscriptionModel] = useState(
    videoConfig?.transcriptionModel ?? "whisper-1"
  );

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (videoConfig) {
      setEnabled(videoConfig.enabled);
      setMaxLengthSeconds(videoConfig.maxLengthSeconds);
      setYtDlpVersion(videoConfig.ytDlpVersion);
      setTranscriptionProvider(videoConfig.transcriptionProvider);
      setTranscriptionEndpoint(videoConfig.transcriptionEndpoint ?? "");
      setTranscriptionModel(videoConfig.transcriptionModel);
    }
  }, [videoConfig]);

  const transcriptionEnabled = transcriptionProvider !== "disabled";
  const needsTranscriptionEndpoint = transcriptionProvider === "generic-openai";
  const needsTranscriptionApiKey =
    transcriptionProvider === "openai" || transcriptionProvider === "generic-openai";
  // Check if API key is configured (masked value will be "••••••••")
  const isTranscriptionApiKeyConfigured =
    !!videoConfig?.transcriptionApiKey && videoConfig.transcriptionApiKey !== "";
  // Check if AI config API key can be used as fallback
  const isAIApiKeyConfigured = !!aiConfig?.apiKey && aiConfig.apiKey !== "";

  // Validation: Can't enable video processing without valid transcription config
  // API key can fall back to AI config API key
  const hasValidTranscription =
    transcriptionEnabled &&
    (transcriptionModel ?? "").trim() !== "" &&
    (!needsTranscriptionEndpoint || (transcriptionEndpoint ?? "").trim() !== "") &&
    (!needsTranscriptionApiKey ||
      (transcriptionApiKey ?? "").trim() !== "" ||
      isTranscriptionApiKeyConfigured ||
      isAIApiKeyConfigured);

  const canEnable = !enabled || hasValidTranscription;
  const showValidationWarning = enabled && !hasValidTranscription;

  const handleRevealTranscriptionApiKey = useCallback(async () => {
    return await fetchConfigSecret(ServerConfigKeys.VIDEO_CONFIG, "transcriptionApiKey");
  }, [fetchConfigSecret]);

  const handleSave = async () => {
    if (enabled && !hasValidTranscription) return;

    setSaving(true);
    try {
      await updateVideoConfig({
        enabled,
        maxLengthSeconds,
        ytDlpVersion,
        transcriptionProvider,
        transcriptionEndpoint: transcriptionEndpoint || undefined,
        transcriptionApiKey: transcriptionApiKey || undefined,
        transcriptionModel,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-2">
      {/* Video Processing Section */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-medium">Enable Video Parsing</span>
          <span className="text-default-500 text-base">
            Extract recipes from TikTok, Instagram, YouTube Shorts or Facebook
          </span>
        </div>
        <Switch color="success" isSelected={enabled} onValueChange={setEnabled} />
      </div>

      {showValidationWarning && (
        <div className="text-warning bg-warning/10 rounded-lg p-3 text-base">
          Configure a transcription provider below to enable video processing.
        </div>
      )}

      <Input
        description="Longer videos take more time and resources to process"
        isDisabled={!enabled}
        label="Max Video Length (seconds)"
        type="number"
        value={maxLengthSeconds.toString()}
        onValueChange={(v) => setMaxLengthSeconds(parseInt(v) || 120)}
      />

      <Input
        description="Version of yt-dlp to use for video downloads"
        isDisabled={!enabled}
        label="yt-dlp Version"
        value={ytDlpVersion}
        onValueChange={setYtDlpVersion}
      />

      <Divider className="my-2" />

      {/* Transcription Section */}
      <div className="flex flex-col gap-1">
        <span className="font-medium">Transcription</span>
        <span className="text-default-500 text-base">
          Convert video audio to text for recipe extraction
        </span>
      </div>

      <Select
        description="Only OpenAI and OpenAI-compatible endpoints support Whisper transcription"
        isDisabled={!enabled}
        label="Transcription Provider"
        selectedKeys={[transcriptionProvider]}
        onSelectionChange={(keys) =>
          setTranscriptionProvider(Array.from(keys)[0] as TranscriptionProvider)
        }
      >
        <SelectItem key="disabled">Disabled</SelectItem>
        <SelectItem key="openai">OpenAI Whisper</SelectItem>
        <SelectItem key="generic-openai">Generic OpenAI-compatible</SelectItem>
      </Select>

      {transcriptionEnabled && (
        <>
          {needsTranscriptionEndpoint && (
            <Input
              description="OpenAI-compatible endpoint with Whisper support"
              isDisabled={!enabled}
              label="Endpoint URL"
              placeholder="https://api.example.com/v1"
              value={transcriptionEndpoint}
              onValueChange={setTranscriptionEndpoint}
            />
          )}

          <Input
            description="Whisper model to use for transcription"
            isDisabled={!enabled}
            label="Model"
            placeholder={transcriptionProvider === "openai" ? "whisper-1" : "whisper"}
            value={transcriptionModel}
            onValueChange={setTranscriptionModel}
          />

          {needsTranscriptionApiKey && (
            <SecretInput
              description="Falls back to AI Configuration API key if not set"
              isConfigured={isTranscriptionApiKeyConfigured}
              isDisabled={!enabled}
              label="API Key"
              placeholder="Leave empty to use AI config key"
              value={transcriptionApiKey}
              onReveal={handleRevealTranscriptionApiKey}
              onValueChange={setTranscriptionApiKey}
            />
          )}
        </>
      )}

      <div className="flex items-center justify-end pt-2">
        <Button
          color="primary"
          isDisabled={!canEnable}
          isLoading={saving}
          startContent={<CheckIcon className="h-5 w-5" />}
          onPress={handleSave}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
