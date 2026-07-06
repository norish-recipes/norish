"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SettingsSwitch from "@/app/(app)/settings/components/settings-switch";
import SecretInput from "@/components/shared/secret-input";
import { useAvailableTranscriptionModelsQuery } from "@/hooks/admin";
import { CheckIcon } from "@heroicons/react/16/solid";
import {
  Button,
  ComboBox,
  Description,
  Input,
  InputGroup,
  Label,
  ListBox,
  Select,
  Separator,
  Spinner,
  TextField,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import type { TranscriptionProvider } from "@norish/config/zod/server-config";
import {
  isCloudTranscriptionProvider,
  ServerConfigKeys,
  transcriptionProviderNeedsEndpoint,
  transcriptionProviderSupportsModelListing,
} from "@norish/config/zod/server-config";

import { useAdminSettingsContext } from "../context";

interface VideoProcessingFormProps {
  onDirtyChange?: (isDirty: boolean) => void;
}
type TranscriptionModel = {
  id: string;
  name: string;
};
type TranscriptionModelOption = {
  value: string;
  label: string;
};
const TRANSCRIPTION_PROVIDER_OPTIONS: TranscriptionProvider[] = [
  "disabled",
  "openai",
  "groq",
  "azure",
  "ollama",
  "generic-openai",
];
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
  const [ytDlpProxy, setYtDlpProxy] = useState(videoConfig?.ytDlpProxy ?? "");
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
      setYtDlpProxy(videoConfig.ytDlpProxy ?? "");
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
    const options = (availableTranscriptionModels as TranscriptionModel[]).map((m) => ({
      value: m.id,
      label: m.name,
    }));

    // Add current model if not in list (allows keeping custom/typed values)
    if (
      transcriptionModel &&
      !options.some((o: TranscriptionModelOption) => o.value === transcriptionModel)
    ) {
      options.unshift({
        value: transcriptionModel,
        label: transcriptionModel,
      });
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
      const firstModel = (availableTranscriptionModels as TranscriptionModel[])[0];
      if (firstModel) {
        setTranscriptionModel(firstModel.id);
      }
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
      ytDlpProxy !== (videoConfig.ytDlpProxy ?? "") ||
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
    ytDlpProxy,
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
        maxVideoFileSize: maxVideoFileSizeMB * 1024 * 1024,
        // Convert MB to bytes
        ytDlpVersion,
        ytDlpProxy: ytDlpProxy || undefined,
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
          <span className="text-muted text-base">{t("enableVideoDescription")}</span>
        </div>
        <SettingsSwitch
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

      <TextField
        isDisabled={isVideoUiDisabled}
        type="number"
        value={maxLengthSeconds.toString()}
        onChange={(value) => setMaxLengthSeconds(parseInt(value) || 120)}
      >
        <Label>{t("maxLength")}</Label>
        <Input variant="secondary" />
        <Description>{t("maxLengthDescription")}</Description>
      </TextField>

      <TextField
        isDisabled={isVideoUiDisabled}
        type="number"
        value={maxVideoFileSizeMB.toString()}
        onChange={(value) => setMaxVideoFileSizeMB(parseInt(value) || 100)}
      >
        <Label>{t("maxFileSize")}</Label>
        <InputGroup variant="secondary">
          <InputGroup.Input min={1} />
          <InputGroup.Suffix>
            <span className="text-muted text-sm">MB</span>
          </InputGroup.Suffix>
        </InputGroup>
        <Description>{t("maxFileSizeDescription")}</Description>
      </TextField>

      <TextField isDisabled={isVideoUiDisabled} value={ytDlpVersion} onChange={setYtDlpVersion}>
        <Label>{t("ytDlpVersion")}</Label>
        <Input variant="secondary" />
        <Description>{t("ytDlpVersionDescription")}</Description>
      </TextField>

      <TextField isDisabled={isVideoUiDisabled} value={ytDlpProxy} onChange={setYtDlpProxy}>
        <Label>{t("ytDlpProxy")}</Label>
        <Input variant="secondary" placeholder="socks5://127.0.0.1:1080" />
        <Description>{t("ytDlpProxyDescription")}</Description>
      </TextField>

      <Separator className="my-2" />

      {/* Transcription Section */}
      <div className="flex flex-col gap-1">
        <span className="font-medium">{t("transcription")}</span>
        <span className="text-muted text-base">{t("transcriptionDescription")}</span>
      </div>

      <Select
        variant="secondary"
        isDisabled={isVideoUiDisabled}
        placeholder={t("transcriptionProvider")}
        value={transcriptionProvider}
        onChange={(selected) => {
          if (typeof selected === "string") {
            handleTranscriptionProviderChange(selected as TranscriptionProvider);
          }
        }}
      >
        <Label>{t("transcriptionProvider")}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <span className="text-muted px-1 text-xs">{t("transcriptionProviderDescription")}</span>
        <Select.Popover>
          <ListBox>
            {TRANSCRIPTION_PROVIDER_OPTIONS.map((option) => {
              const label =
                option === "generic-openai"
                  ? t("transcriptionProviders.genericOpenai")
                  : t(`transcriptionProviders.${option}` as Parameters<typeof t>[0]);

              return (
                <ListBox.Item key={option} id={option} textValue={label}>
                  {label}
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>

      {transcriptionEnabled && (
        <>
          {needsTranscriptionEndpoint && (
            <TextField
              isDisabled={isVideoUiDisabled}
              value={transcriptionEndpoint}
              onChange={setTranscriptionEndpoint}
            >
              <Label>{t("transcriptionEndpoint")}</Label>
              <Input
                variant="secondary"
                placeholder={
                  transcriptionProvider === "ollama"
                    ? "http://localhost:11434"
                    : transcriptionProvider === "generic-openai"
                      ? "http://localhost:8000 (faster-whisper-server) or http://localhost:8080 (LocalAI)"
                      : "https://api.example.com/v1"
                }
              />
              <Description>{t("transcriptionEndpointDescription")}</Description>
            </TextField>
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
            <ComboBox
              allowsCustomValue
              inputValue={transcriptionModel}
              isDisabled={
                isVideoUiDisabled || (!transcriptionApiKey && !isTranscriptionApiKeyConfigured)
              }
              onInputChange={setTranscriptionModel}
              onSelectionChange={(key) => key && setTranscriptionModel(key as string)}
            >
              <Label>{t("transcriptionModel")}</Label>
              <ComboBox.InputGroup>
                <Input variant="secondary" placeholder={t("transcriptionModelPlaceholder")} />
                <ComboBox.Trigger />
              </ComboBox.InputGroup>
              <Description>{t("transcriptionModelDescription")}</Description>
              <ComboBox.Popover>
                <ListBox
                  renderEmptyState={() =>
                    isLoadingTranscriptionModels ? (
                      <div className="flex justify-center py-2">
                        <Spinner size="sm" />
                      </div>
                    ) : null
                  }
                >
                  {transcriptionModelOptions.map((item) => (
                    <ListBox.Item key={item.value} id={item.value} textValue={item.label}>
                      {item.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </ComboBox.Popover>
            </ComboBox>
          )}

          {needsTranscriptionModel && !supportsModelListing && (
            <TextField
              isDisabled={isVideoUiDisabled}
              value={transcriptionModel}
              onChange={setTranscriptionModel}
            >
              <Label>{t("transcriptionModel")}</Label>
              <Input variant="secondary" placeholder={t("transcriptionModelPlaceholder")} />
              <Description>{t("transcriptionModelDescription")}</Description>
            </TextField>
          )}
        </>
      )}

      <div className="flex items-center justify-end pt-2">
        <Button
          isDisabled={!canEnable || !hasChanges}
          onPress={handleSave}
          variant="primary"
          isPending={saving}
        >
          {<CheckIcon className="h-5 w-5" />}
          {tActions("save")}
        </Button>
      </div>
    </div>
  );
}
