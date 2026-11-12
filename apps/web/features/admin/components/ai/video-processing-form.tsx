"use client";

import { useState } from "react";
import { SwitchRow } from "@/components/settings/setting-row";
import SettingsSwitch from "@/components/settings/settings-switch";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Note } from "@/components/shared/note";
import SecretInput from "@/components/shared/secret-input";
import { usePending } from "@/hooks/use-pending";
import { Description, Input, InputGroup, Label, Separator, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { TranscriptionProvider } from "@norish/config/zod/server-config";
import {
  isCloudTranscriptionProvider,
  ServerConfigKeys,
  transcriptionProviderNeedsEndpoint,
  transcriptionProviderSupportsModelListing,
} from "@norish/config/zod/server-config";
import {
  useAdminConfig,
  useAvailableTranscriptionModelsQuery,
  useConfigSecret,
  useVideoConfigMutation,
  useYtDlpVersionQuery,
} from "@norish/shared-react/admin";

import { useReportDirty } from "../use-report-dirty";
import { ModelPicker } from "./model-picker";
import { ProviderSelect } from "./provider-select";

interface VideoProcessingFormProps {
  onDirtyChange?: (isDirty: boolean) => void;
}
const TRANSCRIPTION_PROVIDER_OPTIONS: TranscriptionProvider[] = [
  "disabled",
  "openai",
  "groq",
  "mistral",
  "azure",
  "ollama",
  "generic-openai",
];
export default function VideoProcessingForm({ onDirtyChange }: VideoProcessingFormProps) {
  const t = useTranslations("settings.admin.videoConfig");
  const tActions = useTranslations("common.actions");
  const videoConfig = useAdminConfig(ServerConfigKeys.VIDEO_CONFIG);
  const aiConfig = useAdminConfig(ServerConfigKeys.AI_CONFIG, (ai) => ({
    enabled: ai?.enabled ?? false,
    hasApiKey: !!ai?.apiKey,
  }));
  const updateVideoConfig = useVideoConfigMutation();
  const fetchConfigSecret = useConfigSecret();

  // Combined video + transcription config state
  const [enabled, setEnabled] = useState(videoConfig?.enabled ?? false);
  const [maxLengthSeconds, setMaxLengthSeconds] = useState(videoConfig?.maxLengthSeconds ?? 120);
  const [maxVideoFileSizeMB, setMaxVideoFileSizeMB] = useState(
    videoConfig ? Math.round(videoConfig.maxVideoFileSize / (1024 * 1024)) : 100
  );
  const [ytDlpProxy, setYtDlpProxy] = useState(videoConfig?.ytDlpProxy ?? "");
  const [transcriptionProvider, setTranscriptionProvider] = useState<TranscriptionProvider>(
    videoConfig?.transcriptionProvider ?? "disabled"
  );
  const [transcriptionEndpoint, setTranscriptionEndpoint] = useState(
    videoConfig?.transcriptionEndpoint ?? ""
  );
  const [transcriptionApiKey, setTranscriptionApiKey] = useState("");
  const [isTranscriptionKeyCleared, setIsTranscriptionKeyCleared] = useState(false);
  const [transcriptionModel, setTranscriptionModel] = useState(
    videoConfig?.transcriptionModel ?? ""
  );
  const [saving, whileSaving] = usePending();
  const [prevVideoConfig, setPrevVideoConfig] = useState(videoConfig);

  if (videoConfig !== prevVideoConfig) {
    setPrevVideoConfig(videoConfig);
    if (videoConfig) {
      setEnabled(videoConfig.enabled);
      setMaxLengthSeconds(videoConfig.maxLengthSeconds);
      setMaxVideoFileSizeMB(Math.round(videoConfig.maxVideoFileSize / (1024 * 1024)));
      setYtDlpProxy(videoConfig.ytDlpProxy ?? "");
      setTranscriptionProvider(videoConfig.transcriptionProvider);
      setTranscriptionEndpoint(videoConfig.transcriptionEndpoint ?? "");
      setTranscriptionModel(videoConfig.transcriptionModel);
    }
  }
  const transcriptionEnabled = transcriptionProvider !== "disabled";
  const needsTranscriptionEndpoint = transcriptionProviderNeedsEndpoint(transcriptionProvider);
  const needsTranscriptionApiKey = isCloudTranscriptionProvider(transcriptionProvider);
  const supportsOptionalApiKey = transcriptionProvider === "generic-openai";
  const needsTranscriptionModel = transcriptionEnabled;
  const supportsModelListing = transcriptionProviderSupportsModelListing(transcriptionProvider);
  // A stored (masked) key counts only for the provider it was saved with.
  const providerMatchesSaved = transcriptionProvider === videoConfig?.transcriptionProvider;
  const isTranscriptionApiKeyConfigured =
    !isTranscriptionKeyCleared &&
    providerMatchesSaved &&
    !!videoConfig?.transcriptionApiKey &&
    videoConfig.transcriptionApiKey !== "";
  const isAIApiKeyConfigured = aiConfig?.hasApiKey ?? false;
  const isAIEnabled = aiConfig?.enabled ?? false;

  // The fetch and the picker share this: cloud providers may borrow the AI key,
  // local ones answer to an endpoint alone.
  const hasTranscriptionCredentials = needsTranscriptionApiKey
    ? !!transcriptionApiKey || isTranscriptionApiKeyConfigured || isAIApiKeyConfigured
    : !needsTranscriptionEndpoint || !!transcriptionEndpoint;
  const canFetchTranscriptionModels =
    enabled && transcriptionEnabled && supportsModelListing && hasTranscriptionCredentials;
  // The server's yt-dlp binary, read even with video off: that is when imports broke.
  const {
    version: ytDlpVersion,
    error: ytDlpVersionError,
    isLoading: isLoadingYtDlpVersion,
  } = useYtDlpVersionQuery();
  // A failed read says "unknown", never "no binary".
  const ytDlpVersionLabel = isLoadingYtDlpVersion
    ? t("ytDlpVersionLoading")
    : ytDlpVersionError
      ? t("ytDlpVersionUnknown")
      : (ytDlpVersion ?? t("ytDlpVersionMissing"));
  const {
    models: availableTranscriptionModels,
    refusal: transcriptionRefusal,
    isLoading: isLoadingTranscriptionModels,
  } = useAvailableTranscriptionModelsQuery(
    canFetchTranscriptionModels
      ? {
          provider: transcriptionProvider,
          endpoint: transcriptionEndpoint || undefined,
          apiKey: transcriptionApiKey || undefined,
        }
      : null
  );

  // Auto-select first available model if none selected
  if (
    !transcriptionModel &&
    availableTranscriptionModels.length > 0 &&
    !isLoadingTranscriptionModels
  ) {
    const firstModel = availableTranscriptionModels[0];
    if (firstModel) {
      setTranscriptionModel(firstModel.id);
    }
  }

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
  const hasChanges = (() => {
    if (!videoConfig) return false;
    return (
      enabled !== videoConfig.enabled ||
      maxLengthSeconds !== videoConfig.maxLengthSeconds ||
      maxVideoFileSizeMB !== Math.round(videoConfig.maxVideoFileSize / (1024 * 1024)) ||
      ytDlpProxy !== (videoConfig.ytDlpProxy ?? "") ||
      transcriptionProvider !== videoConfig.transcriptionProvider ||
      transcriptionEndpoint !== (videoConfig.transcriptionEndpoint ?? "") ||
      transcriptionModel !== videoConfig.transcriptionModel ||
      transcriptionApiKey.trim() !== "" ||
      isTranscriptionKeyCleared
    );
  })();
  useReportDirty(hasChanges, onDirtyChange);
  const handleRevealTranscriptionApiKey = () =>
    fetchConfigSecret(ServerConfigKeys.VIDEO_CONFIG, "transcriptionApiKey");
  const handleSave = async () => {
    if (enabled && !hasValidTranscription) return;
    await whileSaving(() =>
      updateVideoConfig({
        enabled,
        maxLengthSeconds,
        maxVideoFileSize: maxVideoFileSizeMB * 1024 * 1024,
        ytDlpProxy: ytDlpProxy || undefined,
        transcriptionProvider,
        transcriptionEndpoint: transcriptionEndpoint || undefined,
        // Empty removes the stored key, so transcription uses the AI key; omitted keeps it.
        transcriptionApiKey: transcriptionApiKey || (isTranscriptionKeyCleared ? "" : undefined),
        transcriptionModel,
      })
        // A saved key lives on the server; left in state it reads as unsaved.
        .then((answer) => {
          if (!answer) return;
          setTranscriptionApiKey("");
          setIsTranscriptionKeyCleared(false);
        })
    );
  };
  return (
    <div className="flex flex-col gap-4">
      {/* Video Processing Section */}
      <SwitchRow description={t("enableVideoDescription")} title={t("enableVideo")}>
        <SettingsSwitch isDisabled={!isAIEnabled} isSelected={enabled} onValueChange={setEnabled} />
      </SwitchRow>

      {showAiDisabledWarning && <Note status="warning">{t("aiDisabledWarning")}</Note>}

      {showValidationWarning && <Note status="warning">{t("configureWarning")}</Note>}

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
            <span className="text-muted text-sm">{t("maxFileSizeUnit")}</span>
          </InputGroup.Suffix>
        </InputGroup>
        <Description>{t("maxFileSizeDescription")}</Description>
      </TextField>

      <TextField isReadOnly value={ytDlpVersionLabel}>
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

      <ProviderSelect
        isDisabled={isVideoUiDisabled}
        label={t("transcriptionProvider")}
        messages="settings.admin.videoConfig.transcriptionProviders"
        options={TRANSCRIPTION_PROVIDER_OPTIONS}
        value={transcriptionProvider}
        onChange={handleTranscriptionProviderChange}
      />

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
                      ? t("transcriptionEndpointPlaceholderGeneric")
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
              onClear={() => setIsTranscriptionKeyCleared(true)}
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
              onClear={() => setIsTranscriptionKeyCleared(true)}
              onReveal={handleRevealTranscriptionApiKey}
              onValueChange={setTranscriptionApiKey}
            />
          )}

          {needsTranscriptionModel && supportsModelListing && (
            <ModelPicker
              description={t("transcriptionModelDescription")}
              isDisabled={isVideoUiDisabled || !hasTranscriptionCredentials}
              isLoading={isLoadingTranscriptionModels}
              label={t("transcriptionModel")}
              options={availableTranscriptionModels.map((m) => ({ id: m.id, label: m.name }))}
              placeholder={t("transcriptionModelPlaceholder")}
              refusal={transcriptionRefusal}
              value={transcriptionModel}
              onChange={setTranscriptionModel}
            />
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

      <ActionButtonGroup className="pt-2">
        <ActionButton
          action="save"
          isDisabled={!canEnable || !hasChanges}
          isPending={saving}
          onPress={handleSave}
        >
          {tActions("save")}
        </ActionButton>
      </ActionButtonGroup>
    </div>
  );
}
