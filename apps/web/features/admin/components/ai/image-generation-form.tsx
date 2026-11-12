"use client";

import { useState } from "react";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import SecretInput from "@/components/shared/secret-input";
import { usePending } from "@/hooks/use-pending";
import { Description, Input, Label, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { ImageGenerationProvider } from "@norish/config/zod/server-config";
import {
  imageGenerationProviderNeedsEndpoint,
  isCloudImageGenerationProvider,
  ServerConfigKeys,
} from "@norish/config/zod/server-config";
import {
  useAdminConfig,
  useAvailableModelsQuery,
  useConfigSecret,
  useImageGenerationConfigMutation,
} from "@norish/shared-react/admin";

import { useReportDirty } from "../use-report-dirty";
import { ModelPicker } from "./model-picker";
import { ProviderSelect } from "./provider-select";

interface ImageGenerationFormProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

/**
 * Only providers whose SDK package exposes an image model are offered
 * (ADR-0024); the rest of the AI provider list cannot be selected here.
 */
const PROVIDER_OPTIONS: ImageGenerationProvider[] = [
  "disabled",
  "openai",
  "google",
  "azure",
  "ollama",
  "lm-studio",
  "generic-openai",
];

export default function ImageGenerationForm({ onDirtyChange }: ImageGenerationFormProps) {
  const t = useTranslations("settings.admin.imageGenerationConfig");
  const tActions = useTranslations("common.actions");
  const imageGenerationConfig = useAdminConfig(ServerConfigKeys.IMAGE_GENERATION_CONFIG);
  const aiConfig = useAdminConfig(ServerConfigKeys.AI_CONFIG, (ai) => ({
    provider: ai?.provider,
    endpoint: ai?.endpoint,
    hasApiKey: !!ai?.apiKey,
  }));
  const updateImageGenerationConfig = useImageGenerationConfigMutation();
  const fetchConfigSecret = useConfigSecret();
  const [provider, setProvider] = useState<ImageGenerationProvider>(
    imageGenerationConfig?.provider ?? "disabled"
  );
  const [model, setModel] = useState(imageGenerationConfig?.model ?? "");
  const [endpoint, setEndpoint] = useState(imageGenerationConfig?.endpoint ?? "");
  const [apiKey, setApiKey] = useState("");
  const [isApiKeyCleared, setIsApiKeyCleared] = useState(false);
  const [saving, whileSaving] = usePending();

  const [prevImageGenerationConfig, setPrevImageGenerationConfig] = useState(imageGenerationConfig);

  if (imageGenerationConfig !== prevImageGenerationConfig) {
    setPrevImageGenerationConfig(imageGenerationConfig);
    if (imageGenerationConfig) {
      setProvider(imageGenerationConfig.provider);
      setModel(imageGenerationConfig.model ?? "");
      setEndpoint(imageGenerationConfig.endpoint ?? "");
    }
  }

  const enabled = provider !== "disabled";
  const needsEndpoint = enabled && imageGenerationProviderNeedsEndpoint(provider);
  const supportsOptionalEndpoint = provider === "azure";
  const isCloud = enabled && isCloudImageGenerationProvider(provider);
  const showApiKey = isCloud || provider === "generic-openai";
  // Endpoint and key fall back to the AI configuration when the provider
  // matches, so a matching setup needs neither typed again.
  const aiProviderMatches = enabled && aiConfig?.provider === provider;
  // Its own key and a borrowed AI key stay apart: only its own can be revealed.
  const hasOwnApiKey =
    !isApiKeyCleared &&
    !!imageGenerationConfig?.apiKey &&
    imageGenerationConfig.provider === provider;
  const inheritsAiApiKey = !hasOwnApiKey && aiProviderMatches && !!aiConfig?.hasApiKey;

  const canFetchModels =
    enabled &&
    (isCloud
      ? !!apiKey || hasOwnApiKey || inheritsAiApiKey
      : (endpoint ?? "").trim() !== "" || aiProviderMatches);

  const {
    models: availableModels,
    refusal: modelRefusal,
    isLoading: isLoadingModels,
  } = useAvailableModelsQuery(
    // Every drawing provider is also an AI provider, so this assignment
    // type-checks without a cast — and fails the build if the enums diverge.
    canFetchModels
      ? {
          provider,
          endpoint: endpoint || (aiProviderMatches ? aiConfig?.endpoint : undefined),
          apiKey: apiKey || undefined,
          // Only the provider's models that can draw, where their names say so; any name may still be typed.
          purpose: "image",
        }
      : null
  );

  const hasChanges =
    provider !== (imageGenerationConfig?.provider ?? "disabled") ||
    model !== (imageGenerationConfig?.model ?? "") ||
    endpoint !== (imageGenerationConfig?.endpoint ?? "") ||
    apiKey.trim() !== "" ||
    isApiKeyCleared;

  useReportDirty(hasChanges, onDirtyChange);

  // The key worth showing is the one a request would actually run with: this
  // block's own, or the AI configuration's when that is what it borrows.
  const handleRevealApiKey = async () => {
    const own = isApiKeyCleared
      ? null
      : await fetchConfigSecret(ServerConfigKeys.IMAGE_GENERATION_CONFIG, "apiKey");

    if (own) return own;

    return inheritsAiApiKey ? await fetchConfigSecret(ServerConfigKeys.AI_CONFIG, "apiKey") : null;
  };

  const handleProviderChange = (newProvider: ImageGenerationProvider) => {
    if (newProvider === provider) return;
    setProvider(newProvider);
    // Model names and keys never carry across providers.
    setApiKey("");
    setIsApiKeyCleared(false);
    setModel("");
    if (!imageGenerationProviderNeedsEndpoint(newProvider) && newProvider !== "azure") {
      setEndpoint("");
    }
  };

  const handleSave = async () => {
    await whileSaving(() =>
      updateImageGenerationConfig({
        provider,
        model: model || undefined,
        endpoint: endpoint || undefined,
        // Empty removes the stored key, so the AI key is used; omitted keeps it.
        apiKey: apiKey || (isApiKeyCleared ? "" : undefined),
      }).then((answer) => {
        if (!answer) return;
        setApiKey("");
        setIsApiKeyCleared(false);
      })
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">{t("description")}</p>

      <ProviderSelect
        label={t("provider")}
        messages="settings.admin.imageGenerationConfig.providers"
        options={PROVIDER_OPTIONS}
        value={provider}
        onChange={handleProviderChange}
      />

      {aiProviderMatches && <p className="text-muted text-xs">{t("fallbackHint")}</p>}

      {(needsEndpoint || supportsOptionalEndpoint) && (
        <TextField value={endpoint} onChange={setEndpoint}>
          <Label>{t("endpoint")}</Label>
          <Input
            variant="secondary"
            placeholder={
              provider === "azure"
                ? "https://your-resource.openai.azure.com"
                : provider === "ollama"
                  ? "http://localhost:11434"
                  : "http://localhost:1234"
            }
          />
          {supportsOptionalEndpoint && <Description>{t("endpointOptional")}</Description>}
        </TextField>
      )}

      {showApiKey && (
        <SecretInput
          description={inheritsAiApiKey ? t("apiKeyInherited") : undefined}
          // A borrowed key is still a key in effect: the field says so and can
          // show it, rather than reading as an unset one.
          isConfigured={hasOwnApiKey || inheritsAiApiKey}
          label={t("apiKey")}
          placeholder={t("apiKeyPlaceholder")}
          value={apiKey}
          onClear={hasOwnApiKey ? () => setIsApiKeyCleared(true) : undefined}
          onReveal={handleRevealApiKey}
          onValueChange={setApiKey}
        />
      )}

      {enabled && (
        <ModelPicker
          description={t("modelDescription")}
          isDisabled={!canFetchModels}
          isLoading={isLoadingModels}
          label={t("model")}
          options={availableModels.map((available) => ({ id: available.id, label: available.id }))}
          placeholder={t("modelPlaceholder")}
          refusal={modelRefusal}
          value={model}
          onChange={setModel}
        />
      )}

      <ActionButtonGroup className="pt-2">
        <ActionButton
          action="save"
          isDisabled={!hasChanges}
          isPending={saving}
          onPress={handleSave}
        >
          {tActions("save")}
        </ActionButton>
      </ActionButtonGroup>
    </div>
  );
}
