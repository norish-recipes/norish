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

import { useAdminSettingsContext } from "../context";

import { ServerConfigKeys, type AIConfig } from "@/server/db/zodSchemas/server-config";
import { useAvailableModelsQuery } from "@/hooks/admin";
import SecretInput from "@/components/shared/secret-input";

export default function AIConfigForm() {
  const { aiConfig, updateAIConfig, testAIEndpoint, fetchConfigSecret } = useAdminSettingsContext();

  const [enabled, setEnabled] = useState(aiConfig?.enabled ?? false);
  const [provider, setProvider] = useState(aiConfig?.provider ?? "openai");
  const [endpoint, setEndpoint] = useState(aiConfig?.endpoint ?? "");
  const [model, setModel] = useState(aiConfig?.model ?? "gpt-5-mini");
  const [visionModel, setVisionModel] = useState(aiConfig?.visionModel ?? "");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(aiConfig?.temperature ?? 0);
  const [maxTokens, setMaxTokens] = useState(aiConfig?.maxTokens ?? 10000);
  const [autoTagAllergies, setAutoTagAllergies] = useState(aiConfig?.autoTagAllergies ?? true);
  const [alwaysUseAI, setAlwaysUseAI] = useState(aiConfig?.alwaysUseAI ?? false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch available models from the provider
  const needsEndpoint = provider !== "openai" && provider !== "perplexity";
  const needsApiKey = provider === "openai" || provider === "generic-openai" || provider === "perplexity";
  const isApiKeyConfigured = !!aiConfig?.apiKey;

  const canFetchModels =
    enabled &&
    (provider === "openai" || provider === "perplexity"
      ? apiKey || isApiKeyConfigured
      : provider === "ollama" || provider === "lm-studio"
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
      label: m.name,
      supportsVision: m.supportsVision,
    }));

    // Add current model if not in list (allows keeping custom/typed values)
    if (model && !options.some((o) => o.value === model)) {
      options.unshift({ value: model, label: model, supportsVision: undefined });
    }

    return options;
  }, [availableModels, model]);

  // Vision model options (filter to vision-capable models if available)
  const visionModelOptions = useMemo(() => {
    const options = availableModels.map((m) => ({
      value: m.id,
      label: m.name,
      supportsVision: m.supportsVision,
    }));

    // Add current vision model if not in list
    if (visionModel && !options.some((o) => o.value === visionModel)) {
      options.unshift({ value: visionModel, label: visionModel, supportsVision: undefined });
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
    }
  }, [aiConfig]);

  // Validation: Can't enable AI without valid config
  const hasValidConfig =
    (model ?? "").trim() !== "" &&
    (!needsEndpoint || (endpoint ?? "").trim() !== "") &&
    (!needsApiKey || (apiKey ?? "").trim() !== "" || isApiKeyConfigured);

  const canEnable = !enabled || hasValidConfig;
  const showValidationWarning = enabled && !hasValidConfig;

  const handleRevealApiKey = useCallback(async () => {
    return await fetchConfigSecret(ServerConfigKeys.AI_CONFIG, "apiKey");
  }, [fetchConfigSecret]);

  // Clear model fields when provider changes to avoid invalid model selection
  const handleProviderChange = (newProvider: AIConfig["provider"]) => {
    if (newProvider !== provider) {
      setProvider(newProvider);
      // Set sensible defaults based on provider
      if (newProvider === "openai") {
        setModel("gpt-5-mini");
        setVisionModel("");
      } else if (newProvider === "perplexity") {
        setModel("sonar");
        setVisionModel("");
      } else {
        setModel("");
        setVisionModel("");
      }
      // Clear endpoint when switching to OpenAI or Perplexity (don't need one)
      if (newProvider === "openai" || newProvider === "perplexity") {
        setEndpoint("");
      }
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
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-2">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-medium">Enable AI Features</span>
          <span className="text-default-500 text-base">
            Use AI to extract recipes from unstructured content
          </span>
        </div>
        <Switch color="success" isSelected={enabled} onValueChange={setEnabled} />
      </div>

      {showValidationWarning && (
        <div className="text-warning bg-warning/10 rounded-lg p-3 text-base">
          Configure the AI provider settings below to enable AI features.
        </div>
      )}

      <Select
        isDisabled={!enabled}
        label="AI Provider"
        selectedKeys={[provider]}
        onSelectionChange={(keys) => handleProviderChange(Array.from(keys)[0] as AIConfig["provider"])}
      >
        <SelectItem key="openai">OpenAI</SelectItem>
        <SelectItem key="perplexity">Perplexity</SelectItem>
        <SelectItem key="ollama">Ollama (Local)</SelectItem>
        <SelectItem key="lm-studio">LM Studio (Local)</SelectItem>
        <SelectItem key="generic-openai">Generic OpenAI-compatible</SelectItem>
      </Select>

      {needsEndpoint && (
        <Input
          isDisabled={!enabled}
          label="Endpoint URL"
          placeholder={provider === "ollama" ? "http://localhost:11434" : "http://localhost:1234"}
          value={endpoint}
          onValueChange={setEndpoint}
        />
      )}

      <Autocomplete
        allowsCustomValue
        defaultItems={modelOptions}
        inputValue={model}
        isDisabled={!enabled}
        isLoading={isLoadingModels}
        label="Model"
        placeholder={provider === "openai" ? "gpt-5-mini" : "llama3"}
        onInputChange={setModel}
        onSelectionChange={(key) => key && setModel(key as string)}
      >
        {(item) => (
          <AutocompleteItem key={item.value} textValue={item.label}>
            <div className="flex items-center justify-between gap-2">
              <span>{item.label}</span>
              {item.supportsVision && (
                <span className="text-success-500 text-xs">vision</span>
              )}
            </div>
          </AutocompleteItem>
        )}
      </Autocomplete>

      <Autocomplete
        allowsCustomValue
        defaultItems={visionModelOptions}
        description="Optional: Use a different model for image/vision tasks. Leave empty to use the model above."
        inputValue={visionModel}
        isDisabled={!enabled}
        isLoading={isLoadingModels}
        label="Vision Model (Optional)"
        placeholder={provider === "openai" ? "gpt-4o" : ""}
        onInputChange={setVisionModel}
        onSelectionChange={(key) => key && setVisionModel(key as string)}
      >
        {(item) => (
          <AutocompleteItem key={item.value} textValue={item.label}>
            <div className="flex items-center justify-between gap-2">
              <span>{item.label}</span>
              {item.supportsVision && (
                <span className="text-success-500 text-xs">vision</span>
              )}
            </div>
          </AutocompleteItem>
        )}
      </Autocomplete>

      {needsApiKey && (
        <SecretInput
          isConfigured={isApiKeyConfigured}
          isDisabled={!enabled}
          label="API Key"
          placeholder="Enter API key"
          value={apiKey}
          onReveal={handleRevealApiKey}
          onValueChange={setApiKey}
        />
      )}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Temperature: {temperature}</label>
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
        <span className="text-default-500 text-xs">
          Lower = more focused, Higher = more creative
        </span>
      </div>

      <Input
        isDisabled={!enabled}
        label="Max Tokens"
        type="number"
        value={maxTokens.toString()}
        onValueChange={(v) => setMaxTokens(parseInt(v) || 10000)}
      />

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="font-medium">Auto-detect Allergy Tags</span>
          <span className="text-default-500 text-base">
            Automatically add allergy-related tags when importing recipes
          </span>
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
          <span className="font-medium">Always Use AI Importing</span>
          <span className="text-default-500 text-base">
            Skip structured parsers and extract recipes using AI only
          </span>
        </div>
        <Switch
          color="success"
          isDisabled={!enabled}
          isSelected={alwaysUseAI}
          onValueChange={setAlwaysUseAI}
        />
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
              Connection successful
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
          Test Connection
        </Button>
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
