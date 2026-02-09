"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Input,
  Button,
  Switch,
  Select,
  SelectItem,
  Divider,
  Autocomplete,
  AutocompleteItem,
} from "@heroui/react";
import { CheckIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useAdminSettingsContext } from "../context";

import {
  ServerConfigKeys,
  type TranscriptionProvider,
  isCloudTranscriptionProvider,
  transcriptionProviderNeedsEndpoint,
  transcriptionProviderSupportsModelListing,
} from "@/server/db/zodSchemas/server-config";
import { useAvailableTranscriptionModelsQuery } from "@/hooks/admin";
import SecretInput from "@/components/shared/secret-input";

interface VideoProcessingFormProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export default function VideoProcessingForm({ onDirtyChange }: VideoProcessingFormProps) {
  const t = useTranslations("settings.admin.videoConfig");
  const tActions = useTranslations("common.actions");
  const { videoConfig, updateVideoConfig, aiConfig, fetchConfigSecret } = useAdminSettingsContext();

  // Combined video + transcription config state
  const [enabled, setEnabled] = useState(videoConfig?.enabled ?? false);
  const [maxLengthSeconds, setMaxLengthSeconds] = useState(videoConfig?.maxLengthSeconds ?? 120);
  const [maxVideoFileSizeMB, setMaxVideoFileSizeMB] = useState(
    videoConfig ? Math.round(videoConfig.maxVideoFileSize / (1024 * 1024)) : 100
  );
  const [ytDlpVersion, setYtDlpVersion] = useState(videoConfig?.ytDlpVersion ?? "2025.11.12");
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider>(
    videoConfig?.transcriptionProvider ?? "disabled"
  );
  const [transcriptionEndpoint, setTranscriptionEndpoint] = useState(
    videoConfig?.transcriptionEndpoint ?? ""
  );
  const [transcriptionApiKey, setTranscriptionApiKey] = useState("");
  const [transcriptionModel, setTranscriptionModel] = useState(
    videoConfig?.transcriptionModel ?? ""
  );

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (videoConfig) {
      setEnabled(videoConfig.enabled);
      setMaxLengthSeconds(videoConfig.maxLengthSeconds);
      setMaxVideoFileSizeMB(Math.round(videoConfig.maxVideoFileSize / (1024 * 1024)));
      setYtDlpVersion(videoConfig.ytDlpVersion);
      setTranscriptionProvider(videoConfig.transcriptionProvider);
      setTranscriptionEndpoint(videoConfig.transcriptionEndpoint ?? "");
      setTranscriptionModel(videoConfig.transcriptionModel);
    }
  }, [videoConfig]);

  const transcriptionEnabled = transcriptionProvider !== "disabled";
  const needsTranscriptionEndpoint = transcriptionProviderNeedsEndpoint(transcriptionProvider);
  // API key only required for cloud providers, not for local models (generic-openai, ollama)
  const needsTranscriptionApiKey = isCloudTranscriptionProvider(transcriptionProvider);
  // API key is optional for generic-openai (Ollama, LM Studio, etc.)
  const supportsOptionalApiKey = transcriptionProvider === "generic-openai";
  // All enabled providers need a model
  const needsTranscriptionModel = transcriptionEnabled;
  // Providers that support dynamic model listing
  const supportsModelListing = transcriptionProviderSupportsModelListing(transcriptionProvider);
  // Check if API key is configured (masked value will be "••••••••")
  // Only consider it configured if the provider hasn't changed from saved config
  const providerMatchesSaved = transcriptionProvider === videoConfig?.transcriptionProvider;
  const isTranscriptionApiKeyConfigured =
    providerMatchesSaved &&
    !!videoConfig?.transcriptionApiKey &&
    videoConfig.transcriptionApiKey !== "";
  // Check if AI config API key can be used as fallback
  const isAIApiKeyConfigured = !!aiConfig?.apiKey && aiConfig.apiKey !== "";
  const isAIEnabled = aiConfig?.enabled ?? false;

  // Determine if we can fetch transcription models
  // Cloud providers need API key, local providers need endpoint
  const canFetchTranscriptionModels =
    enabled &&
    transcriptionEnabled &&
    supportsModelListing &&
    (needsTranscriptionApiKey
      ? transcriptionApiKey || isTranscriptionApiKeyConfigured || isAIApiKeyConfigured
      : transcriptionEndpoint);

  const { models: availableTranscriptionModels, isLoading: isLoadingTranscriptionModels } =
    useAvailableTranscriptionModelsQuery({
      provider: transcriptionProvider,
      endpoint: transcriptionEndpoint || undefined,
      apiKey: transcriptionApiKey || undefined,
      enabled: !!canFetchTranscriptionModels,
    });

  // Create transcription model options for autocomplete
  const transcriptionModelOptions = useMemo(() => {
    const options = availableTranscriptionModels.map((m) => ({
      value: m.id,
      label: m.name,
    }));

    // Add current model if not in list (allows keeping custom/typed values)
    if (transcriptionModel && !options.some((o) => o.value === transcriptionModel)) {
      options.unshift({ value: transcriptionModel, label: transcriptionModel });
    }

    return options;
  }, [availableTranscriptionModels, transcriptionModel]);

  // Auto-select first available model if none selected
  useEffect(() => {
    if (
      !transcriptionModel &&
      availableTranscriptionModels.length > 0 &&
      !isLoadingTranscriptionModels
    ) {
      setTranscriptionModel(availableTranscriptionModels[0].id);
    }
  }, [availableTranscriptionModels, transcriptionModel, isLoadingTranscriptionModels]);

  // Clear transcription config when provider changes - will auto-select first available model
  const handleTranscriptionProviderChange = (newProvider: TranscriptionProvider) => {
    if (newProvider === transcriptionProvider) return;

    setTranscriptionProvider(newProvider);
    // Clear API key and model when switching providers
    setTranscriptionApiKey("");
    setTranscriptionModel("");
    // Clear endpoint when switching to cloud providers (they don't need one)
    if (!transcriptionProviderNeedsEndpoint(newProvider)) {
      setTranscriptionEndpoint("");
    }
  };

  // Validation: Can't enable video processing without valid transcription config
  // API key can fall back to AI config API key
  const hasValidTranscription =
    transcriptionEnabled &&
    (!needsTranscriptionModel || (transcriptionModel ?? "").trim() !== "") &&
    (!needsTranscriptionEndpoint || (transcriptionEndpoint ?? "").trim() !== "") &&
    (!needsTranscriptionApiKey ||
      (transcriptionApiKey ?? "").trim() !== "" ||
      isTranscriptionApiKeyConfigured ||
      isAIApiKeyConfigured);

  const canEnable = !enabled || hasValidTranscription;
  const showValidationWarning = enabled && !hasValidTranscription;
  const isVideoUiDisabled = !enabled || !isAIEnabled;
  const showAiDisabledWarning = !isAIEnabled;
  const hasChanges = useMemo(() => {
    if (!videoConfig) return false;

    return (
      enabled !== videoConfig.enabled ||
      maxLengthSeconds !== videoConfig.maxLengthSeconds ||
      maxVideoFileSizeMB !== Math.round(videoConfig.maxVideoFileSize / (1024 * 1024)) ||
      ytDlpVersion !== videoConfig.ytDlpVersion ||
      transcriptionProvider !== videoConfig.transcriptionProvider ||
      transcriptionEndpoint !== (videoConfig.transcriptionEndpoint ?? "") ||
      transcriptionModel !== videoConfig.transcriptionModel ||
      transcriptionApiKey.trim() !== ""
    );
  }, [
    videoConfig,
    enabled,
    maxLengthSeconds,
    maxVideoFileSizeMB,
    ytDlpVersion,
    transcriptionProvider,
    transcriptionEndpoint,
    transcriptionModel,
    transcriptionApiKey,
  ]);

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

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
        maxVideoFileSize: maxVideoFileSizeMB * 1024 * 1024, // Convert MB to bytes
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
          <span className="font-medium">{t("enableVideo")}</span>
          <span className="text-default-500 text-base">{t("enableVideoDescription")}</span>
        </div>
        <Switch
          color="success"
          isDisabled={!isAIEnabled}
          isSelected={enabled}
          onValueChange={setEnabled}
        />
      </div>

      {showAiDisabledWarning && (
        <div className="text-warning bg-warning/10 rounded-lg p-3 text-base">
          {t("aiDisabledWarning")}
        </div>
      )}

      {showValidationWarning && (
        <div className="text-warning bg-warning/10 rounded-lg p-3 text-base">
          {t("configureWarning")}
        </div>
      )}

      <Input
        description={t("maxLengthDescription")}
        isDisabled={isVideoUiDisabled}
        label={t("maxLength")}
        type="number"
        value={maxLengthSeconds.toString()}
        onValueChange={(v) => setMaxLengthSeconds(parseInt(v) || 120)}
      />

      <Input
        description={t("maxFileSizeDescription")}
        endContent={<span className="text-default-400 text-sm">MB</span>}
        isDisabled={isVideoUiDisabled}
        label={t("maxFileSize")}
        min={1}
        type="number"
        value={maxVideoFileSizeMB.toString()}
        onValueChange={(v) => setMaxVideoFileSizeMB(parseInt(v) || 100)}
      />

      <Input
        description={t("ytDlpVersionDescription")}
        isDisabled={isVideoUiDisabled}
        label={t("ytDlpVersion")}
        value={ytDlpVersion}
        onValueChange={setYtDlpVersion}
      />

      <Divider className="my-2" />

      {/* Transcription Section */}
      <div className="flex flex-col gap-1">
        <span className="font-medium">{t("transcription")}</span>
        <span className="text-default-500 text-base">{t("transcriptionDescription")}</span>
      </div>

      <Select
        description={t("transcriptionProviderDescription")}
        isDisabled={isVideoUiDisabled}
        label={t("transcriptionProvider")}
        selectedKeys={[transcriptionProvider]}
        onSelectionChange={(keys) =>
          handleTranscriptionProviderChange(Array.from(keys)[0] as TranscriptionProvider)
        }
      >
        <SelectItem key="disabled">{t("transcriptionProviders.disabled")}</SelectItem>
        <SelectItem key="openai">{t("transcriptionProviders.openai")}</SelectItem>
        <SelectItem key="groq">{t("transcriptionProviders.groq")}</SelectItem>
        <SelectItem key="azure">{t("transcriptionProviders.azure")}</SelectItem>
        <SelectItem key="ollama">{t("transcriptionProviders.ollama")}</SelectItem>
        <SelectItem key="generic-openai">{t("transcriptionProviders.genericOpenai")}</SelectItem>
      </Select>

      {transcriptionEnabled && (
        <>
          {needsTranscriptionEndpoint && (
            <Input
              description={t("transcriptionEndpointDescription")}
              isDisabled={isVideoUiDisabled}
              label={t("transcriptionEndpoint")}
              placeholder={
                transcriptionProvider === "ollama"
                  ? "http://localhost:11434"
                  : transcriptionProvider === "generic-openai"
                    ? "http://localhost:8000 (faster-whisper-server) or http://localhost:8080 (LocalAI)"
                    : "https://api.example.com/v1"
              }
              value={transcriptionEndpoint}
              onValueChange={setTranscriptionEndpoint}
            />
          )}

          {needsTranscriptionApiKey && (
            <SecretInput
              description={t("transcriptionApiKeyDescription")}
              isConfigured={isTranscriptionApiKeyConfigured}
              isDisabled={isVideoUiDisabled}
              label={t("transcriptionApiKey")}
              placeholder={t("transcriptionApiKeyPlaceholder")}
              value={transcriptionApiKey}
              onReveal={handleRevealTranscriptionApiKey}
              onValueChange={setTranscriptionApiKey}
            />
          )}

          {supportsOptionalApiKey && (
            <SecretInput
              description={t("transcriptionApiKeyOptionalDescription")}
              isConfigured={isTranscriptionApiKeyConfigured}
              isDisabled={isVideoUiDisabled}
              label={t("transcriptionApiKeyOptional")}
              placeholder={t("transcriptionApiKeyOptionalPlaceholder")}
              value={transcriptionApiKey}
              onReveal={handleRevealTranscriptionApiKey}
              onValueChange={setTranscriptionApiKey}
            />
          )}

          {needsTranscriptionModel && supportsModelListing && (
            <Autocomplete
              allowsCustomValue
              defaultItems={transcriptionModelOptions}
              description={t("transcriptionModelDescription")}
              inputValue={transcriptionModel}
              isDisabled={
                isVideoUiDisabled || (!transcriptionApiKey && !isTranscriptionApiKeyConfigured)
              }
              isLoading={isLoadingTranscriptionModels}
              label={t("transcriptionModel")}
              placeholder={t("transcriptionModelPlaceholder")}
              onInputChange={setTranscriptionModel}
              onSelectionChange={(key) => key && setTranscriptionModel(key as string)}
            >
              {(item) => (
                <AutocompleteItem key={item.value} textValue={item.label}>
                  {item.label}
                </AutocompleteItem>
              )}
            </Autocomplete>
          )}

          {needsTranscriptionModel && !supportsModelListing && (
            <Input
              description={t("transcriptionModelDescription")}
              isDisabled={isVideoUiDisabled}
              label={t("transcriptionModel")}
              placeholder={t("transcriptionModelPlaceholder")}
              value={transcriptionModel}
              onValueChange={setTranscriptionModel}
            />
          )}
        </>
      )}

      <div className="flex items-center justify-end pt-2">
        <Button
          color="primary"
          isDisabled={!canEnable || !hasChanges}
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
