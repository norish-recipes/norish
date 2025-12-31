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

import { ServerConfigKeys, type TranscriptionProvider } from "@/server/db/zodSchemas/server-config";
import { useAvailableTranscriptionModelsQuery } from "@/hooks/admin";
import SecretInput from "@/components/shared/secret-input";

export default function VideoProcessingForm() {
  const t = useTranslations("settings.admin.videoConfig");
  const tActions = useTranslations("common.actions");
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

  // Determine if we can fetch transcription models
  const canFetchTranscriptionModels =
    enabled &&
    transcriptionEnabled &&
    (transcriptionProvider === "openai"
      ? transcriptionApiKey || isTranscriptionApiKeyConfigured || isAIApiKeyConfigured
      : transcriptionEndpoint);

  const {
    models: availableTranscriptionModels,
    isLoading: isLoadingTranscriptionModels,
  } = useAvailableTranscriptionModelsQuery({
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

  // Clear transcription model when provider changes
  const handleTranscriptionProviderChange = (newProvider: TranscriptionProvider) => {
    setTranscriptionProvider(newProvider);
    // Clear model when switching providers to avoid invalid model selection
    if (newProvider !== transcriptionProvider) {
      setTranscriptionModel(newProvider === "openai" ? "whisper-1" : "");
    }
  };

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
          <span className="font-medium">{t("enableVideo")}</span>
          <span className="text-default-500 text-base">
            {t("enableVideoDescription")}
          </span>
        </div>
        <Switch color="success" isSelected={enabled} onValueChange={setEnabled} />
      </div>

      {showValidationWarning && (
        <div className="text-warning bg-warning/10 rounded-lg p-3 text-base">
          {t("configureWarning")}
        </div>
      )}

      <Input
        description={t("maxLengthDescription")}
        isDisabled={!enabled}
        label={t("maxLength")}
        type="number"
        value={maxLengthSeconds.toString()}
        onValueChange={(v) => setMaxLengthSeconds(parseInt(v) || 120)}
      />

      <Input
        description={t("ytDlpVersionDescription")}
        isDisabled={!enabled}
        label={t("ytDlpVersion")}
        value={ytDlpVersion}
        onValueChange={setYtDlpVersion}
      />

      <Divider className="my-2" />

      {/* Transcription Section */}
      <div className="flex flex-col gap-1">
        <span className="font-medium">{t("transcription")}</span>
        <span className="text-default-500 text-base">
          {t("transcriptionDescription")}
        </span>
      </div>

      <Select
        description={t("transcriptionProviderDescription")}
        isDisabled={!enabled}
        label={t("transcriptionProvider")}
        selectedKeys={[transcriptionProvider]}
        onSelectionChange={(keys) =>
          handleTranscriptionProviderChange(Array.from(keys)[0] as TranscriptionProvider)
        }
      >
        <SelectItem key="disabled">{t("transcriptionProviders.disabled")}</SelectItem>
        <SelectItem key="openai">{t("transcriptionProviders.openai")}</SelectItem>
        <SelectItem key="generic-openai">{t("transcriptionProviders.genericOpenai")}</SelectItem>
      </Select>

      {transcriptionEnabled && (
        <>
          {needsTranscriptionEndpoint && (
            <Input
              description={t("transcriptionEndpointDescription")}
              isDisabled={!enabled}
              label={t("transcriptionEndpoint")}
              placeholder="https://api.example.com/v1"
              value={transcriptionEndpoint}
              onValueChange={setTranscriptionEndpoint}
            />
          )}

          <Autocomplete
            allowsCustomValue
            defaultItems={transcriptionModelOptions}
            description={t("transcriptionModelDescription")}
            inputValue={transcriptionModel}
            isDisabled={!enabled}
            isLoading={isLoadingTranscriptionModels}
            label={t("transcriptionModel")}
            placeholder={transcriptionProvider === "openai" ? "whisper-1" : "whisper"}
            onInputChange={setTranscriptionModel}
            onSelectionChange={(key) => key && setTranscriptionModel(key as string)}
          >
            {(item) => (
              <AutocompleteItem key={item.value} textValue={item.label}>
                {item.label}
              </AutocompleteItem>
            )}
          </Autocomplete>

          {needsTranscriptionApiKey && (
            <SecretInput
              description={t("transcriptionApiKeyDescription")}
              isConfigured={isTranscriptionApiKeyConfigured}
              isDisabled={!enabled}
              label={t("transcriptionApiKey")}
              placeholder={t("transcriptionApiKeyPlaceholder")}
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
          {tActions("save")}
        </Button>
      </div>
    </div>
  );
}
