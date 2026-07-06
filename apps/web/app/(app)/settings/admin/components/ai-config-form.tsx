"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SettingsSwitch from "@/app/(app)/settings/components/settings-switch";
import SecretInput from "@/components/shared/secret-input";
import { useAvailableModelsQuery } from "@/hooks/admin";
import { BeakerIcon, CheckIcon, XMarkIcon } from "@heroicons/react/16/solid";
import {
  Button,
  Chip,
  ComboBox,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  Slider,
  Spinner,
  TextField,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import type { AIConfig, AutoTaggingMode } from "@norish/config/zod/server-config";
import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { useAdminSettingsContext } from "../context";

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
const PROVIDER_OPTIONS: Array<AIConfig["provider"]> = [
  "openai",
  "azure",
  "anthropic",
  "google",
  "mistral",
  "deepseek",
  "perplexity",
  "groq",
  "ollama",
  "lm-studio",
  "generic-openai",
];
const AUTO_TAGGING_MODE_OPTIONS: AutoTaggingMode[] = [
  "disabled",
  "predefined",
  "predefined_db",
  "freeform",
];
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
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);
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
      options.unshift({
        value: model,
        supportsVision: undefined,
      });
    }
    return options;
  }, [availableModels, model]);

  const visionModelOptions = useMemo(() => {
    const options = (availableModels as AvailableModel[]).map((m) => ({
      value: m.id,
      supportsVision: m.supportsVision,
    }));

    if (visionModel && !options.some((o: ModelOption) => o.value === visionModel)) {
      options.unshift({
        value: visionModel,
        supportsVision: undefined,
      });
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
          <span className="text-muted text-base">{t("enableAIDescription")}</span>
        </div>
        <SettingsSwitch color="success" isSelected={enabled} onValueChange={setEnabled} />
      </div>

      {showValidationWarning && (
        <div className="text-warning bg-warning/10 rounded-lg p-3 text-base">
          {t("configureWarning")}
        </div>
      )}

      <Select
        variant="secondary"
        isDisabled={!enabled}
        placeholder={t("provider")}
        value={provider}
        onChange={(selected) => {
          if (typeof selected === "string") {
            handleProviderChange(selected as AIConfig["provider"]);
          }
        }}
      >
        <Label>{t("provider")}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {PROVIDER_OPTIONS.map((option) => {
              const label =
                option === "lm-studio"
                  ? t("providers.lmStudio")
                  : t(`providers.${option}` as Parameters<typeof t>[0]);

              return (
                <ListBox.Item key={option} id={option} textValue={label}>
                  {label}
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>

      {needsEndpoint && (
        <TextField isDisabled={!enabled} value={endpoint} onChange={setEndpoint}>
          <Label>{t("endpointUrl")}</Label>
          <Input
            variant="secondary"
            placeholder={provider === "ollama" ? "http://localhost:11434" : "http://localhost:1234"}
          />
        </TextField>
      )}

      {supportsOptionalEndpoint && (
        <TextField isDisabled={!enabled} value={endpoint} onChange={setEndpoint}>
          <Label>{t("azureEndpoint")}</Label>
          <Input variant="secondary" placeholder="https://your-resource.openai.azure.com" />
          <Description>{t("azureEndpointDescription")}</Description>
        </TextField>
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

      <ComboBox
        allowsCustomValue
        inputValue={model}
        isDisabled={!enabled || !canFetchModels}
        onInputChange={setModel}
        onSelectionChange={(key) => key && setModel(key as string)}
      >
        <Label>{t("model")}</Label>
        <ComboBox.InputGroup>
          <Input variant="secondary" placeholder={t("model")} />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox
            renderEmptyState={() =>
              isLoadingModels ? (
                <div className="flex justify-center py-2">
                  <Spinner size="sm" />
                </div>
              ) : null
            }
          >
            {modelOptions.map((item) => (
              <ListBox.Item key={item.value} id={item.value} textValue={item.value}>
                <div className="flex items-center justify-between gap-2">
                  <span>{item.value}</span>
                  {item.supportsVision && (
                    <span className="text-success text-xs">{t("vision")}</span>
                  )}
                </div>
              </ListBox.Item>
            ))}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>

      <ComboBox
        allowsCustomValue
        inputValue={visionModel}
        isDisabled={!enabled || !canFetchModels}
        onInputChange={setVisionModel}
        onSelectionChange={(key) => key && setVisionModel(key as string)}
      >
        <Label>{t("visionModel")}</Label>
        <ComboBox.InputGroup>
          <Input variant="secondary" placeholder={t("visionModel")} />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <Description>{t("visionModelDescription")}</Description>
        <ComboBox.Popover>
          <ListBox
            renderEmptyState={() =>
              isLoadingModels ? (
                <div className="flex justify-center py-2">
                  <Spinner size="sm" />
                </div>
              ) : null
            }
          >
            {visionModelOptions.map((item) => (
              <ListBox.Item key={item.value} id={item.value} textValue={item.value}>
                <div className="flex items-center justify-between gap-2">
                  <span>{item.value}</span>
                  {item.supportsVision && (
                    <span className="text-success text-xs">{t("vision")}</span>
                  )}
                </div>
              </ListBox.Item>
            ))}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          {t("temperature", {
            value: temperature,
          })}
        </label>
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
        <span className="text-muted text-xs">{t("temperatureHint")}</span>
      </div>

      <TextField
        isDisabled={!enabled}
        type="number"
        value={maxTokens.toString()}
        onChange={(value) => setMaxTokens(parseInt(value) || 10000)}
      >
        <Label>{t("maxTokens")}</Label>
        <Input variant="secondary" />
      </TextField>

      <TextField
        isDisabled={!enabled}
        type="number"
        value={timeoutMs.toString()}
        onChange={(value) => setTimeoutMs(parseInt(value) || 300000)}
      >
        <Label>{t("requestTimeout")}</Label>
        <Input variant="secondary" />
      </TextField>

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{t("autoTagAllergies")}</span>
          <span className="text-muted text-base">{t("autoTagAllergiesDescription")}</span>
        </div>
        <SettingsSwitch
          color="success"
          isDisabled={!enabled}
          isSelected={autoTagAllergies}
          onValueChange={setAutoTagAllergies}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{t("alwaysUseAI")}</span>
          <span className="text-muted text-base">{t("alwaysUseAIDescription")}</span>
        </div>
        <SettingsSwitch
          color="success"
          isDisabled={!enabled}
          isSelected={alwaysUseAI}
          onValueChange={setAlwaysUseAI}
        />
      </div>

      <Select
        variant="secondary"
        isDisabled={!enabled}
        placeholder={t("autoTaggingMode")}
        value={autoTaggingMode}
        onChange={(selected) => {
          if (typeof selected === "string") {
            setAutoTaggingMode(selected as AutoTaggingMode);
          }
        }}
      >
        <Label>{t("autoTaggingMode")}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <span className="text-muted px-1 text-xs">{t("autoTaggingModeDescription")}</span>
        <Select.Popover>
          <ListBox>
            {AUTO_TAGGING_MODE_OPTIONS.map((option) => {
              const label =
                option === "predefined_db"
                  ? t("autoTaggingModes.predefinedDb")
                  : t(`autoTaggingModes.${option}` as Parameters<typeof t>[0]);

              return (
                <ListBox.Item key={option} id={option} textValue={label}>
                  {label}
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
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
          className={`flex items-center gap-2 rounded-lg p-2 ${testResult.success ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}
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
        <Button isDisabled={!enabled} onPress={handleTest} variant="tertiary" isPending={testing}>
          {<BeakerIcon className="h-5 w-5" />}
          {t("testConnection")}
        </Button>
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
