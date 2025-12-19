"use client";

import { useState, useEffect, useCallback } from "react";
import { Input, Button, Switch, Select, SelectItem, Slider } from "@heroui/react";
import { CheckIcon, BeakerIcon, XMarkIcon } from "@heroicons/react/16/solid";

import { useAdminSettingsContext } from "../context";

import { ServerConfigKeys, type AIConfig } from "@/server/db/zodSchemas/server-config";
import SecretInput from "@/components/shared/secret-input";

export default function AIConfigForm() {
  const { aiConfig, updateAIConfig, testAIEndpoint, fetchConfigSecret } = useAdminSettingsContext();

  const [enabled, setEnabled] = useState(aiConfig?.enabled ?? false);
  const [provider, setProvider] = useState(aiConfig?.provider ?? "openai");
  const [endpoint, setEndpoint] = useState(aiConfig?.endpoint ?? "");
  const [model, setModel] = useState(aiConfig?.model ?? "gpt-4o-mini");
  const [visionModel, setVisionModel] = useState(aiConfig?.visionModel ?? "");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(aiConfig?.temperature ?? 0);
  const [maxTokens, setMaxTokens] = useState(aiConfig?.maxTokens ?? 10000);
  const [autoTagAllergies, setAutoTagAllergies] = useState(aiConfig?.autoTagAllergies ?? true);
  const [alwaysUseAI, setAlwaysUseAI] = useState(aiConfig?.alwaysUseAI ?? false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

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

  const needsEndpoint = provider !== "openai";
  const needsApiKey = provider === "openai" || provider === "generic-openai";
  const isApiKeyConfigured = !!aiConfig?.apiKey;

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
        onSelectionChange={(keys) => setProvider(Array.from(keys)[0] as AIConfig["provider"])}
      >
        <SelectItem key="openai">OpenAI</SelectItem>
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

      <Input
        isDisabled={!enabled}
        label="Model"
        placeholder={provider === "openai" ? "gpt-4o-mini" : "llama3"}
        value={model}
        onValueChange={setModel}
      />

      <Input
        description="Optional: Use a different model for image/vision tasks. Leave empty to use the model above."
        isDisabled={!enabled}
        label="Vision Model (Optional)"
        placeholder={provider === "openai" ? "gpt-4o" : ""}
        value={visionModel}
        onValueChange={setVisionModel}
      />

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
          className={`flex items-center gap-2 rounded-lg p-2 ${testResult.success ? "bg-success-100 text-success-700" : "bg-danger-100 text-danger-700"
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
