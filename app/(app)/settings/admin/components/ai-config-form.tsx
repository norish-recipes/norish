"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Input,
  Button,
  Switch,
  Select,
  SelectItem,
  Slider,
  Autocomplete,
  AutocompleteItem,
} from "@heroui/react";
import { CheckIcon, BeakerIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useAdminSettingsContext } from "../context";

import {
  ServerConfigKeys,
  type AIConfig,
  type AutoTaggingMode,
} from "@/server/db/zodSchemas/server-config";
import { useAvailableModelsQuery } from "@/hooks/admin";
import SecretInput from "@/components/shared/secret-input";

interface AIConfigFormProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

export default function AIConfigForm({ onDirtyChange }: AIConfigFormProps) {
  const t = useTranslations("settings.admin.aiConfig");
  const tActions = useTranslations("common.actions");
  const { aiConfig, updateAIConfig, testAIEndpoint, fetchConfigSecret } = useAdminSettingsContext();

  const [enabled, setEnabled] = useState(aiConfig?.enabled ?? false);
  const [provider, setProvider] = useState(aiConfig?.provider ?? "openai");
  const [endpoint, setEndpoint] = useState(aiConfig?.endpoint ?? "");
  const [model, setModel] = useState(aiConfig?.model ?? "");
  const [visionModel, setVisionModel] = useState(aiConfig?.visionModel ?? "");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(aiConfig?.temperature ?? 0);
  const [maxTokens, setMaxTokens] = useState(aiConfig?.maxTokens ?? 10000);
  const [autoTagAllergies, setAutoTagAllergies] = useState(aiConfig?.autoTagAllergies ?? true);
  const [alwaysUseAI, setAlwaysUseAI] = useState(aiConfig?.alwaysUseAI ?? false);
  const [autoTaggingMode, setAutoTaggingMode] = useState<AutoTaggingMode>(
    aiConfig?.autoTaggingMode ?? "disabled"
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch available models from the provider
  // Cloud providers that don't require an endpoint (use official APIs)
  const cloudProviders = [
    "openai",
    "azure",
    "anthropic",
    "google",
    "mistral",
    "deepseek",
    "perplexity",
    "groq",
  ];
  // Local providers that need an endpoint
  const localProviders = ["ollama", "lm-studio"];
  // Azure optionally accepts endpoint for custom resource URL
  const needsEndpoint = localProviders.includes(provider) || provider === "generic-openai";
  const supportsOptionalEndpoint = provider === "azure";
  // Cloud providers need API key, local providers don't, generic-openai may need one
  const needsApiKey = cloudProviders.includes(provider) || provider === "generic-openai";
  // API key is only considered "configured" if the saved config matches the current provider
  // This prevents validation from passing when switching between providers
  const isApiKeyConfigured = !!aiConfig?.apiKey && aiConfig?.provider === provider;

  const canFetchModels =
    enabled &&
    (cloudProviders.includes(provider)
      ? apiKey || isApiKeyConfigured
      : localProviders.includes(provider)
        ? endpoint
        : endpoint); // generic-openai needs endpoint

  const { models: availableModels, isLoading: isLoadingModels } = useAvailableModelsQuery({
    provider: provider as AIConfig["provider"],
    endpoint: endpoint || undefined,
    apiKey: apiKey || undefined,
    enabled: !!canFetchModels,
  });

  // Create model options for autocomplete (includes current value even if not in list)
  const modelOptions = useMemo(() => {
    const options = availableModels.map((m) => ({
      value: m.id,
      supportsVision: m.supportsVision,
    }));

    // Add current model if not in list (allows keeping custom/typed values)
    if (model && !options.some((o) => o.value === model)) {
      options.unshift({ value: model, supportsVision: undefined });
    }

    return options;
  }, [availableModels, model]);

  // Vision model options (filter to vision-capable models if available)
  const visionModelOptions = useMemo(() => {
    const options = availableModels.map((m) => ({
      value: m.id,
      supportsVision: m.supportsVision,
    }));

    // Add current vision model if not in list
    if (visionModel && !options.some((o) => o.value === visionModel)) {
      options.unshift({ value: visionModel, supportsVision: undefined });
    }

    return options;
  }, [availableModels, visionModel]);

  useEffect(() => {
    if (aiConfig) {
      setEnabled(aiConfig.enabled);
      setProvider(aiConfig.provider);
      setEndpoint(aiConfig.endpoint ?? "");
      setModel(aiConfig.model);
      setVisionModel(aiConfig.visionModel ?? "");
      setTemperature(aiConfig.temperature);
      setMaxTokens(aiConfig.maxTokens);
      setAutoTagAllergies(aiConfig.autoTagAllergies ?? true);
      setAlwaysUseAI(aiConfig.alwaysUseAI ?? false);
      setAutoTaggingMode(aiConfig.autoTaggingMode ?? "disabled");
    }
  }, [aiConfig]);

  // Validation: Can't enable AI without valid config
  const hasValidConfig =
    (model ?? "").trim() !== "" &&
    (!needsEndpoint || (endpoint ?? "").trim() !== "") &&
    (!needsApiKey || (apiKey ?? "").trim() !== "" || isApiKeyConfigured);

  const canEnable = !enabled || hasValidConfig;
  const showValidationWarning = enabled && !hasValidConfig;
  const hasChanges = useMemo(() => {
    if (!aiConfig) return false;

    return (
      enabled !== aiConfig.enabled ||
      provider !== aiConfig.provider ||
      endpoint !== (aiConfig.endpoint ?? "") ||
      model !== aiConfig.model ||
      visionModel !== (aiConfig.visionModel ?? "") ||
      temperature !== aiConfig.temperature ||
      maxTokens !== aiConfig.maxTokens ||
      autoTagAllergies !== (aiConfig.autoTagAllergies ?? true) ||
      alwaysUseAI !== (aiConfig.alwaysUseAI ?? false) ||
      autoTaggingMode !== (aiConfig.autoTaggingMode ?? "disabled") ||
      apiKey.trim() !== ""
    );
  }, [
    aiConfig,
    enabled,
    provider,
    endpoint,
    model,
    visionModel,
    temperature,
    maxTokens,
    autoTagAllergies,
    alwaysUseAI,
    autoTaggingMode,
    apiKey,
  ]);

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  const handleRevealApiKey = useCallback(async () => {
    return await fetchConfigSecret(ServerConfigKeys.AI_CONFIG, "apiKey");
  }, [fetchConfigSecret]);

  // Clear model fields when provider changes to avoid invalid model selection
  const handleProviderChange = (newProvider: AIConfig["provider"]) => {
    if (newProvider !== provider) {
      setProvider(newProvider);
      // Clear API key and models when switching providers - user must select from list
      setApiKey("");
      setModel("");
      setVisionModel("");
      // Clear endpoint when switching to cloud providers (they don't need one)
      const newCloudProviders = [
        "openai",
        "anthropic",
        "google",
        "mistral",
        "deepseek",
        "perplexity",
        "groq",
      ];

      if (newCloudProviders.includes(newProvider)) {
        setEndpoint("");
      }
      // Azure keeps endpoint as optional (for custom resource URL)
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAIEndpoint({
        provider,
        endpoint: endpoint || undefined,
        apiKey: apiKey || undefined,
      });

      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (enabled && !hasValidConfig) return;

    setSaving(true);
    try {
      await updateAIConfig({
        enabled,
        provider: provider as AIConfig["provider"],
        endpoint: endpoint || undefined,
        model,
        visionModel: visionModel || undefined,
        apiKey: apiKey || undefined,
        temperature,
        maxTokens,
        autoTagAllergies,
        alwaysUseAI,
        autoTaggingMode: autoTaggingMode as AIConfig["autoTaggingMode"],
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{t("enableAI")}</span>
          <span className="text-default-500 text-base">{t("enableAIDescription")}</span>
        </div>
        <Switch color="success" isSelected={enabled} onValueChange={setEnabled} />
      </div>

      {showValidationWarning && (
        <div className="text-warning bg-warning/10 rounded-lg p-3 text-base">
          {t("configureWarning")}
        </div>
      )}

      <Select
        isDisabled={!enabled}
        label={t("provider")}
        selectedKeys={[provider]}
        onSelectionChange={(keys) =>
          handleProviderChange(Array.from(keys)[0] as AIConfig["provider"])
        }
      >
        <SelectItem key="openai">{t("providers.openai")}</SelectItem>
        <SelectItem key="azure">{t("providers.azure")}</SelectItem>
        <SelectItem key="anthropic">{t("providers.anthropic")}</SelectItem>
        <SelectItem key="google">{t("providers.google")}</SelectItem>
        <SelectItem key="mistral">{t("providers.mistral")}</SelectItem>
        <SelectItem key="deepseek">{t("providers.deepseek")}</SelectItem>
        <SelectItem key="perplexity">{t("providers.perplexity")}</SelectItem>
        <SelectItem key="groq">{t("providers.groq")}</SelectItem>
        <SelectItem key="ollama">{t("providers.ollama")}</SelectItem>
        <SelectItem key="lm-studio">{t("providers.lmStudio")}</SelectItem>
        <SelectItem key="generic-openai">{t("providers.genericOpenai")}</SelectItem>
      </Select>

      {needsEndpoint && (
        <Input
          isDisabled={!enabled}
          label={t("endpointUrl")}
          placeholder={provider === "ollama" ? "http://localhost:11434" : "http://localhost:1234"}
          value={endpoint}
          onValueChange={setEndpoint}
        />
      )}

      {supportsOptionalEndpoint && (
        <Input
          description={t("azureEndpointDescription")}
          isDisabled={!enabled}
          label={t("azureEndpoint")}
          placeholder="https://your-resource.openai.azure.com"
          value={endpoint}
          onValueChange={setEndpoint}
        />
      )}

      {needsApiKey && (
        <SecretInput
          isConfigured={isApiKeyConfigured}
          isDisabled={!enabled}
          label={t("apiKey")}
          placeholder={t("apiKeyPlaceholder")}
          value={apiKey}
          onReveal={handleRevealApiKey}
          onValueChange={setApiKey}
        />
      )}

      <Autocomplete
        allowsCustomValue
        defaultItems={modelOptions}
        inputValue={model}
        isDisabled={!enabled || !canFetchModels}
        isLoading={isLoadingModels}
        label={t("model")}
        onInputChange={setModel}
        onSelectionChange={(key) => key && setModel(key as string)}
      >
        {(item) => (
          <AutocompleteItem key={item.value} textValue={item.value}>
            <div className="flex items-center justify-between gap-2">
              <span>{item.value}</span>
              {item.supportsVision && (
                <span className="text-success-500 text-xs">{t("vision")}</span>
              )}
            </div>
          </AutocompleteItem>
        )}
      </Autocomplete>

      <Autocomplete
        allowsCustomValue
        defaultItems={visionModelOptions}
        description={t("visionModelDescription")}
        inputValue={visionModel}
        isDisabled={!enabled || !canFetchModels}
        isLoading={isLoadingModels}
        label={t("visionModel")}
        onInputChange={setVisionModel}
        onSelectionChange={(key) => key && setVisionModel(key as string)}
      >
        {(item) => (
          <AutocompleteItem key={item.value} textValue={item.value}>
            <div className="flex items-center justify-between gap-2">
              <span>{item.value}</span>
              {item.supportsVision && (
                <span className="text-success-500 text-xs">{t("vision")}</span>
              )}
            </div>
          </AutocompleteItem>
        )}
      </Autocomplete>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">{t("temperature", { value: temperature })}</label>
        <Slider
          aria-label="Temperature"
          className="max-w-md"
          isDisabled={!enabled}
          maxValue={2}
          minValue={0}
          step={0.1}
          value={temperature}
          onChange={(v) => setTemperature(v as number)}
        />
        <span className="text-default-500 text-xs">{t("temperatureHint")}</span>
      </div>

      <Input
        isDisabled={!enabled}
        label={t("maxTokens")}
        type="number"
        value={maxTokens.toString()}
        onValueChange={(v) => setMaxTokens(parseInt(v) || 10000)}
      />

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{t("autoTagAllergies")}</span>
          <span className="text-default-500 text-base">{t("autoTagAllergiesDescription")}</span>
        </div>
        <Switch
          color="success"
          isDisabled={!enabled}
          isSelected={autoTagAllergies}
          onValueChange={setAutoTagAllergies}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{t("alwaysUseAI")}</span>
          <span className="text-default-500 text-base">{t("alwaysUseAIDescription")}</span>
        </div>
        <Switch
          color="success"
          isDisabled={!enabled}
          isSelected={alwaysUseAI}
          onValueChange={setAlwaysUseAI}
        />
      </div>

      <Select
        description={t("autoTaggingModeDescription")}
        isDisabled={!enabled}
        label={t("autoTaggingMode")}
        selectedKeys={[autoTaggingMode]}
        onSelectionChange={(keys) => setAutoTaggingMode(Array.from(keys)[0] as AutoTaggingMode)}
      >
        <SelectItem key="disabled">{t("autoTaggingModes.disabled")}</SelectItem>
        <SelectItem key="predefined">{t("autoTaggingModes.predefined")}</SelectItem>
        <SelectItem key="predefined_db">{t("autoTaggingModes.predefinedDb")}</SelectItem>
        <SelectItem key="freeform">{t("autoTaggingModes.freeform")}</SelectItem>
      </Select>

      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-lg p-2 ${
            testResult.success ? "bg-success-100 text-success-700" : "bg-danger-100 text-danger-700"
          }`}
        >
          {testResult.success ? (
            <>
              <CheckIcon className="h-4 w-4" />
              {t("connectionSuccess")}
            </>
          ) : (
            <>
              <XMarkIcon className="h-4 w-4" />
              {testResult.error}
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          isDisabled={!enabled}
          isLoading={testing}
          startContent={<BeakerIcon className="h-5 w-5" />}
          variant="flat"
          onPress={handleTest}
        >
          {t("testConnection")}
        </Button>
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
