"use client";

import type { AIConfig, AutoTaggingMode } from "@norish/config/zod/server-config";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BeakerIcon, CheckIcon, XMarkIcon } from "@heroicons/react/16/solid";
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Chip,
  Input,
  Select,
  SelectItem,
  Slider,
  Switch,
} from "@heroui/react";
import { useTranslations } from "next-intl";
import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { useAdminSettingsContext } from "../context";

import { useAvailableModelsQuery } from "@/hooks/admin";
import SecretInput from "@/components/shared/secret-input";

interface AIConfigFormProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

type AvailableModel = {
  id: string;
  supportsVision?: boolean;
};

type ModelOption = {
  value: string;
  supportsVision?: boolean;
};

export default function AIConfigForm({ onDirtyChange }: AIConfigFormProps) {
  const t = useTranslations("settings.admin.aiConfig");
  const tActions = useTranslations("common.actions");
  const { 
    aiConfig, 
    updateAIConfig, 
    testAIEndpoint, 
    fetchConfigSecret, 
    backfillProvenance,
    provenanceStatus
  } = useAdminSettingsContext();

  const [enabled, setEnabled] = useState(aiConfig?.enabled ?? false);
  const [provider, setProvider] = useState(aiConfig?.provider ?? "openai");
  const [endpoint, setEndpoint] = useState(aiConfig?.endpoint ?? "");
  const [model, setModel] = useState(aiConfig?.model ?? "");
  const [visionModel, setVisionModel] = useState(aiConfig?.visionModel ?? "");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(aiConfig?.temperature ?? 0);
  const [maxTokens, setMaxTokens] = useState(aiConfig?.maxTokens ?? 10000);
  const [timeoutMs, setTimeoutMs] = useState(aiConfig?.timeoutMs ?? 300000);
  const [autoTagAllergies, setAutoTagAllergies] = useState(aiConfig?.autoTagAllergies ?? true);
  const [alwaysUseAI, setAlwaysUseAI] = useState(aiConfig?.alwaysUseAI ?? false);
  const [autoTaggingMode, setAutoTaggingMode] = useState<AutoTaggingMode>(
    aiConfig?.autoTaggingMode ?? "disabled"
  );
  const [provenanceEnabled, setProvenanceEnabled] = useState(aiConfig?.provenanceEnabled ?? false);
  const [provenanceAutoNew, setProvenanceAutoNew] = useState(aiConfig?.provenanceAutoNew ?? false);
  const [testing, setTesting] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Fetch available models from the provider
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
  const localProviders = ["ollama", "lm-studio"];
  const needsEndpoint = localProviders.includes(provider) || provider === "generic-openai";
  const supportsOptionalEndpoint = provider === "azure";
  const needsApiKey = cloudProviders.includes(provider) || provider === "generic-openai";
  const isApiKeyConfigured = !!aiConfig?.apiKey && aiConfig?.provider === provider;

  const canFetchModels =
    enabled &&
    (cloudProviders.includes(provider)
      ? apiKey || isApiKeyConfigured
      : localProviders.includes(provider)
        ? endpoint
        : endpoint);

  const { models: availableModels, isLoading: isLoadingModels } = useAvailableModelsQuery({
    provider: provider as AIConfig["provider"],
    endpoint: endpoint || undefined,
    apiKey: apiKey || undefined,
    enabled: !!canFetchModels,
  });

  const modelOptions = useMemo(() => {
    const options = (availableModels as AvailableModel[]).map((m) => ({
      value: m.id,
      supportsVision: m.supportsVision,
    }));

    if (model && !options.some((o: ModelOption) => o.value === model)) {
      options.unshift({ value: model, supportsVision: undefined });
    }

    return options;
  }, [availableModels, model]);

  const visionModelOptions = useMemo(() => {
    const options = (availableModels as AvailableModel[]).map((m) => ({
      value: m.id,
      supportsVision: m.supportsVision,
    }));

    if (visionModel && !options.some((o: ModelOption) => o.value === visionModel)) {
      options.unshift({ value: visionModel, supportsVision: undefined });
    }

    return options;
  }, [availableModels, visionModel]);

  useEffect(() => {
    if (aiConfig && !initialized) {
      setEnabled(aiConfig.enabled);
      setProvider(aiConfig.provider);
      setEndpoint(aiConfig.endpoint ?? "");
      setModel(aiConfig.model);
      setVisionModel(aiConfig.visionModel ?? "");
      setTemperature(aiConfig.temperature);
      setMaxTokens(aiConfig.maxTokens);
      setTimeoutMs(aiConfig.timeoutMs ?? 300000);
      setAutoTagAllergies(aiConfig.autoTagAllergies ?? true);
      setAlwaysUseAI(aiConfig.alwaysUseAI ?? false);
      setAutoTaggingMode(aiConfig.autoTaggingMode ?? "disabled");
      setProvenanceEnabled(aiConfig.provenanceEnabled ?? false);
      setProvenanceAutoNew(aiConfig.provenanceAutoNew ?? false);
      setInitialized(true);
    }
  }, [aiConfig, initialized]);

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
      timeoutMs !== (aiConfig.timeoutMs ?? 300000) ||
      autoTagAllergies !== (aiConfig.autoTagAllergies ?? true) ||
      alwaysUseAI !== (aiConfig.alwaysUseAI ?? false) ||
      autoTaggingMode !== (aiConfig.autoTaggingMode ?? "disabled") ||
      provenanceEnabled !== (aiConfig.provenanceEnabled ?? false) ||
      provenanceAutoNew !== (aiConfig.provenanceAutoNew ?? false) ||
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
    timeoutMs,
    autoTagAllergies,
    alwaysUseAI,
    autoTaggingMode,
    provenanceEnabled,
    provenanceAutoNew,
    apiKey,
  ]);

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  const handleRevealApiKey = useCallback(async () => {
    return await fetchConfigSecret(ServerConfigKeys.AI_CONFIG, "apiKey");
  }, [fetchConfigSecret]);

  const handleProviderChange = (newProvider: AIConfig["provider"]) => {
    if (newProvider !== provider) {
      setProvider(newProvider);
      setApiKey("");
      setModel("");
      setVisionModel("");
      const cloudP = ["openai", "anthropic", "google", "mistral", "deepseek", "perplexity", "groq"];
      if (cloudP.includes(newProvider)) setEndpoint("");
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

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      await backfillProvenance();
    } finally {
      setBackfilling(false);
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
        timeoutMs,
        autoTagAllergies,
        alwaysUseAI,
        autoTaggingMode: autoTaggingMode as AIConfig["autoTaggingMode"],
        provenanceEnabled,
        provenanceAutoNew,
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
        {(item: ModelOption) => (
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
        {(item: ModelOption) => (
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

      <Input
        isDisabled={!enabled}
        label={t("requestTimeout")}
        type="number"
        value={timeoutMs.toString()}
        onValueChange={(v) => setTimeoutMs(parseInt(v) || 300000)}
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

      <div className="border-default-200 flex flex-col gap-4 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {t("provenanceSectionTitle", { fallback: "Recipe Provenance Settings" })}
          </h3>
          {provenanceStatus && provenanceStatus.processed < provenanceStatus.total && (
            <Chip color="primary" size="sm" variant="flat">
              {t("backfillProgress", {
                processed: provenanceStatus.processed,
                total: provenanceStatus.total,
                fallback: `${provenanceStatus.processed} of ${provenanceStatus.total} processed`,
              })}
            </Chip>
          )}
        </div>
        <p className="text-default-500 mb-2 text-sm">
          {t("provenanceDescription", {
            fallback: "You can customize the AI instructions for provenance in the Prompts tab.",
          })}
        </p>

        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{t("provenanceEnabled", { fallback: "Enable Provenance Features" })}</span>
            <span className="text-default-500 text-sm">
              {t("provenanceEnabledDesc", {
                fallback: "Show the provenance spark button on recipe pages.",
              })}
            </span>
          </div>
          <Switch
            aria-label={t("provenanceEnabled", { fallback: "Enable Provenance Features" })}
            color="success"
            isDisabled={!enabled}
            isSelected={provenanceEnabled}
            onValueChange={setProvenanceEnabled}
          />
        </div>

        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{t("provenanceAutoNew", { fallback: "Auto-Infer on Import" })}</span>
            <span className="text-default-500 text-sm">
              {t("provenanceAutoNewDesc", {
                fallback: "Automatically infer origin for newly imported recipes.",
              })}
            </span>
          </div>
          <Switch
            aria-label={t("provenanceAutoNew", { fallback: "Auto-Infer on Import" })}
            color="success"
            isDisabled={!enabled || !provenanceEnabled}
            isSelected={provenanceAutoNew}
            onValueChange={setProvenanceAutoNew}
          />
        </div>

        <div className="border-default-200 flex items-center justify-between border-t pt-4">
          <div className="flex flex-col gap-1">
            <span className="font-medium">
              {t("backfillRecipes", { fallback: "Backfill Existing Recipes" })}
            </span>
            <span className="text-default-500 text-sm">
              {t("backfillRecipesDesc", {
                fallback: "Queue missing recipes for provenance inference.",
              })}
            </span>
          </div>
          <Button
            color="primary"
            isDisabled={!enabled || !provenanceEnabled}
            isLoading={backfilling}
            size="sm"
            variant="flat"
            onPress={handleBackfill}
          >
            {t("startBackfill", { fallback: "Start Batch Processing" })}
          </Button>
        </div>
      </div>

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
