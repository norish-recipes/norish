"use client";

import { useState } from "react";
import { SettingRow, SwitchRow } from "@/components/settings/setting-row";
import SettingsSwitch from "@/components/settings/settings-switch";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import { Note } from "@/components/shared/note";
import SecretInput from "@/components/shared/secret-input";
import { usePending } from "@/hooks/use-pending";
import { Description, Input, Label, ListBox, Select, Slider, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type {
  AIConfig,
  AutomaticEnrichmentConfig,
  CuisineStrategy,
  TagStrategy,
} from "@norish/config/zod/server-config";
import type { WriteResult } from "@norish/shared-react/admin";
import {
  DEFAULT_AI_TIMEOUT_MS,
  DEFAULT_AUTOMATIC_ENRICHMENT,
  DEFAULT_CUISINE_STRATEGY,
  DEFAULT_TAG_STRATEGY,
  ServerConfigKeys,
} from "@norish/config/zod/server-config";
import {
  useAdminConfig,
  useAIConfigWrite,
  useAvailableModelsQuery,
  useConfigSecret,
} from "@norish/shared-react/admin";

import type { ModelOption } from "./model-picker";
import { ConnectionTestResult } from "../connection-test-result";
import { KindsSelect } from "../kinds-select";
import { useReportDirty } from "../use-report-dirty";
import { ModelPicker } from "./model-picker";
import { ProviderSelect } from "./provider-select";

interface AIConfigFormProps {
  onDirtyChange?: (isDirty: boolean) => void;
}
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
/** The providers reached by URL; every other one is a cloud API reached by key. */
const ENDPOINT_PROVIDERS: Array<AIConfig["provider"]> = ["ollama", "lm-studio", "generic-openai"];
const isCloudProvider = (provider: AIConfig["provider"]) => !ENDPOINT_PROVIDERS.includes(provider);
const TAG_STRATEGY_OPTIONS: TagStrategy[] = ["predefined", "predefined_db", "freeform"];
const CUISINE_STRATEGY_OPTIONS: CuisineStrategy[] = ["existing", "extend"];

/** One switch per Recipe Enrichment kind, in the order the docs describe them. */
const AUTOMATIC_ENRICHMENT_KEYS = [
  "autoTagging",
  "allergyDetection",
  "autoCategorization",
  "nutritionEstimation",
  "recipeProvenance",
  "ingredientLinking",
  "imageGeneration",
] as const satisfies readonly (keyof AutomaticEnrichmentConfig)[];

export default function AIConfigForm({ onDirtyChange }: AIConfigFormProps) {
  const t = useTranslations("settings.admin.aiConfig");
  const tActions = useTranslations("common.actions");
  const aiConfig = useAdminConfig(ServerConfigKeys.AI_CONFIG);
  const { save: updateAIConfig, test: testAIEndpoint } = useAIConfigWrite();
  const fetchConfigSecret = useConfigSecret();
  const [enabled, setEnabled] = useState(aiConfig?.enabled ?? false);
  const [provider, setProvider] = useState(aiConfig?.provider ?? "openai");
  const [endpoint, setEndpoint] = useState(aiConfig?.endpoint ?? "");
  const [model, setModel] = useState(aiConfig?.model ?? "");
  const [visionModel, setVisionModel] = useState(aiConfig?.visionModel ?? "");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(aiConfig?.temperature ?? 0);
  const [maxTokens, setMaxTokens] = useState(aiConfig?.maxTokens ?? 10000);
  const [timeoutMs, setTimeoutMs] = useState(aiConfig?.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS);
  const [alwaysUseAI, setAlwaysUseAI] = useState(aiConfig?.alwaysUseAI ?? false);
  const [tagStrategy, setTagStrategy] = useState<TagStrategy>(
    aiConfig?.tagStrategy ?? DEFAULT_TAG_STRATEGY
  );
  const [cuisineStrategy, setCuisineStrategy] = useState<CuisineStrategy>(
    aiConfig?.cuisineStrategy ?? DEFAULT_CUISINE_STRATEGY
  );
  const [automaticEnrichment, setAutomaticEnrichment] = useState<AutomaticEnrichmentConfig>(
    aiConfig?.automaticEnrichment ?? DEFAULT_AUTOMATIC_ENRICHMENT
  );
  const [testing, whileTesting] = usePending();
  const [testResult, setTestResult] = useState<WriteResult | null>(null);
  const [saving, whileSaving] = usePending();

  const needsEndpoint = !isCloudProvider(provider);
  // Azure takes an optional endpoint for a custom resource URL.
  const supportsOptionalEndpoint = provider === "azure";
  const needsApiKey = isCloudProvider(provider) || provider === "generic-openai";
  // A stored key counts only for the provider it was saved with.
  const isApiKeyConfigured = !!aiConfig?.apiKey && aiConfig?.provider === provider;
  const canFetchModels =
    enabled && (isCloudProvider(provider) ? apiKey || isApiKeyConfigured : endpoint);

  const {
    models: availableModels,
    refusal: modelRefusal,
    isLoading: isLoadingModels,
  } = useAvailableModelsQuery(
    canFetchModels
      ? { provider, endpoint: endpoint || undefined, apiKey: apiKey || undefined }
      : null
  );

  // Create model options for autocomplete (includes current value even if not in list)
  const modelOptions: ModelOption[] = availableModels.map((m) => ({
    id: m.id,
    label: m.id,
    tag: m.supportsVision ? t("vision") : undefined,
  }));
  const [prevAiConfig, setPrevAiConfig] = useState(aiConfig);

  if (aiConfig !== prevAiConfig) {
    setPrevAiConfig(aiConfig);
    if (aiConfig) {
      setEnabled(aiConfig.enabled);
      setProvider(aiConfig.provider);
      setEndpoint(aiConfig.endpoint ?? "");
      setModel(aiConfig.model);
      setVisionModel(aiConfig.visionModel ?? "");
      setTemperature(aiConfig.temperature);
      setMaxTokens(aiConfig.maxTokens);
      setTimeoutMs(aiConfig.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS);
      setAlwaysUseAI(aiConfig.alwaysUseAI ?? false);
      setTagStrategy(aiConfig.tagStrategy ?? DEFAULT_TAG_STRATEGY);
      setCuisineStrategy(aiConfig.cuisineStrategy ?? DEFAULT_CUISINE_STRATEGY);
      setAutomaticEnrichment(aiConfig.automaticEnrichment ?? DEFAULT_AUTOMATIC_ENRICHMENT);
    }
  }

  // Validation: Can't enable AI without valid config
  const hasValidConfig =
    (model ?? "").trim() !== "" &&
    (!needsEndpoint || (endpoint ?? "").trim() !== "") &&
    (!needsApiKey || (apiKey ?? "").trim() !== "" || isApiKeyConfigured);
  const canEnable = !enabled || hasValidConfig;
  const showValidationWarning = enabled && !hasValidConfig;
  const hasChanges = (() => {
    if (!aiConfig) return false;
    return (
      enabled !== aiConfig.enabled ||
      provider !== aiConfig.provider ||
      endpoint !== (aiConfig.endpoint ?? "") ||
      model !== aiConfig.model ||
      visionModel !== (aiConfig.visionModel ?? "") ||
      temperature !== aiConfig.temperature ||
      maxTokens !== aiConfig.maxTokens ||
      timeoutMs !== (aiConfig.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS) ||
      alwaysUseAI !== (aiConfig.alwaysUseAI ?? false) ||
      tagStrategy !== (aiConfig.tagStrategy ?? DEFAULT_TAG_STRATEGY) ||
      cuisineStrategy !== (aiConfig.cuisineStrategy ?? DEFAULT_CUISINE_STRATEGY) ||
      AUTOMATIC_ENRICHMENT_KEYS.some(
        (key) =>
          automaticEnrichment[key] !==
          (aiConfig.automaticEnrichment?.[key] ?? DEFAULT_AUTOMATIC_ENRICHMENT[key])
      ) ||
      apiKey.trim() !== ""
    );
  })();
  useReportDirty(hasChanges, onDirtyChange);
  const handleRevealApiKey = () => fetchConfigSecret(ServerConfigKeys.AI_CONFIG, "apiKey");

  /**
   * The stored record read as the list the picker selects over. A column of
   * switches read as separate decisions; which kinds are allowed to run unasked
   * is one. Every kind belongs here — one left out of the list is not merely
   * unreachable, it is rewritten to its default the moment any other kind is
   * toggled, because the picker rebuilds the whole record from this list.
   */
  const selectedEnrichmentKinds = AUTOMATIC_ENRICHMENT_KEYS.filter(
    (key) => automaticEnrichment[key]
  );
  const handleEnrichmentKindsChange = (chosen: (keyof AutomaticEnrichmentConfig)[]) => {
    const selected = new Set(chosen);

    setAutomaticEnrichment(
      Object.fromEntries(
        AUTOMATIC_ENRICHMENT_KEYS.map((key) => [key, selected.has(key)])
      ) as AutomaticEnrichmentConfig
    );
  };

  // Clear model fields when provider changes to avoid invalid model selection
  const handleProviderChange = (newProvider: AIConfig["provider"]) => {
    if (newProvider !== provider) {
      setProvider(newProvider);
      // Clear API key and models when switching providers - user must select from list
      setApiKey("");
      setModel("");
      setVisionModel("");
      // A cloud API takes no endpoint; Azure keeps its optional one.
      if (isCloudProvider(newProvider) && newProvider !== "azure") setEndpoint("");
    }
  };
  const handleTest = async () => {
    setTestResult(null);
    await whileTesting(() =>
      testAIEndpoint({
        provider,
        endpoint: endpoint || undefined,
        apiKey: apiKey || undefined,
      }).then(setTestResult)
    );
  };
  const handleSave = async () => {
    if (!aiConfig || (enabled && !hasValidConfig)) return;
    await whileSaving(() =>
      updateAIConfig({
        enabled,
        provider: provider as AIConfig["provider"],
        endpoint: endpoint || undefined,
        model,
        visionModel: visionModel || undefined,
        apiKey: apiKey || undefined,
        temperature,
        maxTokens,
        timeoutMs,
        alwaysUseAI,
        tagStrategy,
        cuisineStrategy,
        automaticEnrichment,
        // The Ingredient catalogue section saves these.
        automaticIngredients: aiConfig.automaticIngredients,
      })
        // Saved keys live on the server, not in the form: a key left in state
        // reads as an unsaved change on every later render.
        .then(() => setApiKey(""))
    );
  };
  return (
    <div className="flex flex-col gap-4">
      <SwitchRow description={t("enableAIDescription")} title={t("enableAI")}>
        <SettingsSwitch isSelected={enabled} onValueChange={setEnabled} />
      </SwitchRow>

      {showValidationWarning && <Note status="warning">{t("configureWarning")}</Note>}

      <ProviderSelect
        isDisabled={!enabled}
        label={t("provider")}
        messages="settings.admin.aiConfig.providers"
        options={PROVIDER_OPTIONS}
        value={provider}
        onChange={handleProviderChange}
      />

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

      <ModelPicker
        isDisabled={!enabled || !canFetchModels}
        isLoading={isLoadingModels}
        label={t("model")}
        options={modelOptions}
        placeholder={t("model")}
        refusal={modelRefusal}
        value={model}
        onChange={setModel}
      />

      <ModelPicker
        description={t("visionModelDescription")}
        isDisabled={!enabled || !canFetchModels}
        isLoading={isLoadingModels}
        label={t("visionModel")}
        options={modelOptions}
        placeholder={t("visionModel")}
        refusal={modelRefusal}
        value={visionModel}
        onChange={setVisionModel}
      />

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          {t("temperature", {
            value: temperature,
          })}
        </label>
        <Slider
          aria-label={t("temperatureLabel")}
          className="max-w-md"
          isDisabled={!enabled}
          maxValue={2}
          minValue={0}
          step={0.1}
          value={temperature}
          onChange={(v) => setTemperature(v as number)}
        >
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
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
        onChange={(value) => setTimeoutMs(parseInt(value) || DEFAULT_AI_TIMEOUT_MS)}
      >
        <Label>{t("requestTimeout")}</Label>
        <Input variant="secondary" />
      </TextField>

      <SwitchRow description={t("alwaysUseAIDescription")} title={t("alwaysUseAI")}>
        <SettingsSwitch
          isDisabled={!enabled}
          isSelected={alwaysUseAI}
          onValueChange={setAlwaysUseAI}
        />
      </SwitchRow>

      <SettingRow
        description={t("automaticEnrichmentDescription")}
        title={t("automaticEnrichment")}
      >
        <KindsSelect
          isDisabled={!enabled}
          label={t("automaticEnrichment")}
          options={AUTOMATIC_ENRICHMENT_KEYS.map((key) => ({
            id: key,
            label: t(`automaticEnrichmentKinds.${key}`),
            description: t(`automaticEnrichmentKinds.${key}Description`),
          }))}
          placeholder={t("automaticEnrichmentPlaceholder")}
          value={selectedEnrichmentKinds}
          onChange={handleEnrichmentKindsChange}
        />
      </SettingRow>

      <Select
        variant="secondary"
        isDisabled={!enabled}
        placeholder={t("tagStrategy")}
        value={tagStrategy}
        onChange={(selected) => {
          if (typeof selected === "string") {
            setTagStrategy(selected as TagStrategy);
          }
        }}
      >
        <Label>{t("tagStrategy")}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <span className="text-muted px-1 text-xs">{t("tagStrategyDescription")}</span>
        <Select.Popover>
          <ListBox>
            {TAG_STRATEGY_OPTIONS.map((option) => {
              const label =
                option === "predefined_db"
                  ? t("tagStrategies.predefinedDb")
                  : t(`tagStrategies.${option}` as Parameters<typeof t>[0]);

              return (
                <ListBox.Item key={option} id={option} textValue={label}>
                  {label}
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>

      <Select
        variant="secondary"
        isDisabled={!enabled}
        placeholder={t("cuisineStrategy")}
        value={cuisineStrategy}
        onChange={(selected) => {
          if (typeof selected === "string") {
            setCuisineStrategy(selected as CuisineStrategy);
          }
        }}
      >
        <Label>{t("cuisineStrategy")}</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <span className="text-muted px-1 text-xs">{t("cuisineStrategyDescription")}</span>
        <Select.Popover>
          <ListBox>
            {CUISINE_STRATEGY_OPTIONS.map((option) => {
              const label = t(`cuisineStrategies.${option}`);

              return (
                <ListBox.Item key={option} id={option} textValue={label}>
                  {label}
                </ListBox.Item>
              );
            })}
          </ListBox>
        </Select.Popover>
      </Select>

      <ConnectionTestResult result={testResult} successLabel={t("connectionSuccess")} />

      <ActionButtonGroup className="pt-2">
        <ActionButton action="test" isDisabled={!enabled} isPending={testing} onPress={handleTest}>
          {tActions("test")}
        </ActionButton>
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
