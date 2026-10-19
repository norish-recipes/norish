"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SettingRow } from "@/app/(app)/settings/components/setting-row";
import SecretInput from "@/components/shared/secret-input";
import { BeakerIcon, CheckIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button, Description, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { DecisionProvider, DecisionUse } from "@norish/config/zod/server-config";
import {
  DECISION_USES,
  decisionProviderDefaults,
  decisionProviderNeedsEndpoint,
  DEFAULT_DECISION_ENDPOINT,
  DEFAULT_DECISION_MODEL,
  selectedDecisionUses,
  ServerConfigKeys,
} from "@norish/config/zod/server-config";

import { useAdminSettingsContext } from "../context";

interface DecisionModelFormProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

const PROVIDER_OPTIONS: DecisionProvider[] = ["disabled", "typesafe", "generic-openai"];

const PROVIDER_LABEL_KEYS: Record<DecisionProvider, string> = {
  disabled: "disabled",
  typesafe: "typesafe",
  "generic-openai": "genericOpenai",
};

/** Two selections are the same selection whatever order they were clicked in. */
function sameUses(a: readonly DecisionUse[], b: readonly DecisionUse[]): boolean {
  return a.length === b.length && DECISION_USES.every((use) => a.includes(use) === b.includes(use));
}

export default function DecisionModelForm({ onDirtyChange }: DecisionModelFormProps) {
  const t = useTranslations("settings.admin.decisionConfig");
  const tActions = useTranslations("common.actions");
  const {
    decisionConfig,
    aiConfig,
    updateDecisionConfig,
    testDecisionEndpoint,
    fetchConfigSecret,
  } = useAdminSettingsContext();
  const initialDefaults = decisionProviderDefaults(decisionConfig?.provider ?? "disabled");
  const [provider, setProvider] = useState<DecisionProvider>(
    decisionConfig?.provider ?? "disabled"
  );
  const [model, setModel] = useState(decisionConfig?.model ?? initialDefaults.model);
  const [endpoint, setEndpoint] = useState(decisionConfig?.endpoint ?? initialDefaults.endpoint);
  const [apiKey, setApiKey] = useState("");
  const [uses, setUses] = useState<DecisionUse[]>(decisionConfig?.uses ?? [...DECISION_USES]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (decisionConfig) {
      const defaults = decisionProviderDefaults(decisionConfig.provider);

      setProvider(decisionConfig.provider);
      setModel(decisionConfig.model ?? defaults.model);
      setEndpoint(decisionConfig.endpoint ?? defaults.endpoint);
      setUses(decisionConfig.uses ?? [...DECISION_USES]);
    }
  }, [decisionConfig]);

  const enabled = provider !== "disabled";
  const aiEnabled = aiConfig?.enabled ?? false;
  const needsEndpoint = decisionProviderNeedsEndpoint(provider);
  const hasStoredApiKey = !!decisionConfig?.apiKey && decisionConfig.provider === provider;
  const hasApiKey = hasStoredApiKey || apiKey.trim() !== "";
  const hasConnection =
    !needsEndpoint || (model.trim() !== "" && endpoint.trim() !== "" && hasApiKey);

  const hasChanges = useMemo(() => {
    const stored = decisionConfig;
    const storedDefaults = decisionProviderDefaults(stored?.provider ?? "disabled");

    return (
      provider !== (stored?.provider ?? "disabled") ||
      model !== (stored?.model ?? storedDefaults.model) ||
      endpoint !== (stored?.endpoint ?? storedDefaults.endpoint) ||
      apiKey.trim() !== "" ||
      !sameUses(uses, stored?.uses ?? DECISION_USES)
    );
  }, [decisionConfig, provider, model, endpoint, apiKey, uses]);

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  const handleRevealApiKey = useCallback(
    () => fetchConfigSecret(ServerConfigKeys.DECISION_CONFIG, "apiKey"),
    [fetchConfigSecret]
  );

  const handleProviderChange = (newProvider: DecisionProvider) => {
    if (newProvider === provider) return;

    const defaults = decisionProviderDefaults(newProvider);

    setProvider(newProvider);
    setModel(defaults.model);
    setEndpoint(defaults.endpoint);
    setApiKey("");
    setTestResult(null);
  };

  const handleUsesChange = (selected: string[]) => {
    setUses(DECISION_USES.filter((use) => selected.includes(use)));
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testDecisionEndpoint({
        provider,
        apiKey: apiKey || undefined,
        model: model || undefined,
        endpoint: endpoint.trim() || undefined,
      });

      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!hasConnection) return;

    setSaving(true);
    try {
      await updateDecisionConfig({
        provider,
        model: model || undefined,
        endpoint: endpoint.trim() || undefined,
        // An empty key preserves the stored one on the server.
        apiKey: apiKey || undefined,
        // Every use selected is stored as no list, so the block keeps meaning
        // "every use" and a use added later is on for it (ADR-0035).
        uses: selectedDecisionUses(uses),
      });
      setApiKey("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Select
        variant="secondary"
        placeholder={t("provider")}
        value={provider}
        onChange={(selected) => {
          if (typeof selected === "string") {
            handleProviderChange(selected as DecisionProvider);
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
            {PROVIDER_OPTIONS.map((option) => (
              <ListBox.Item
                key={option}
                id={option}
                textValue={t(`providers.${PROVIDER_LABEL_KEYS[option]}`)}
              >
                {t(`providers.${PROVIDER_LABEL_KEYS[option]}`)}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {enabled && (
        <>
          <SecretInput
            description={needsEndpoint ? t("apiKeyDescriptionGeneric") : t("apiKeyDescription")}
            isConfigured={hasStoredApiKey}
            isRequired={needsEndpoint}
            label={t("apiKey")}
            placeholder={t("apiKeyPlaceholder")}
            value={apiKey}
            onReveal={handleRevealApiKey}
            onValueChange={setApiKey}
          />

          <TextField value={model} onChange={setModel}>
            <Label>{t("model")}</Label>
            <Input
              variant="secondary"
              placeholder={needsEndpoint ? t("modelPlaceholderGeneric") : DEFAULT_DECISION_MODEL}
            />
          </TextField>

          <TextField value={endpoint} onChange={setEndpoint}>
            <Label>{t("endpoint")}</Label>
            <Input
              placeholder={
                needsEndpoint ? t("endpointPlaceholderGeneric") : DEFAULT_DECISION_ENDPOINT
              }
              variant="secondary"
            />
            <Description>
              {needsEndpoint ? t("endpointDescriptionGeneric") : t("endpointDescription")}
            </Description>
          </TextField>
        </>
      )}

      <SettingRow title={t("uses")}>
        <Select
          aria-label={t("uses")}
          className="w-full"
          isDisabled={!enabled}
          placeholder={t("usesPlaceholder")}
          selectionMode="multiple"
          value={uses}
          variant="secondary"
          onChange={(selected) => handleUsesChange(selected.map(String))}
        >
          <Label className="sr-only">{t("uses")}</Label>
          <Select.Trigger>
            <Select.Value className="min-w-0">
              {({ defaultChildren, isPlaceholder }) =>
                isPlaceholder ? (
                  defaultChildren
                ) : (
                  <span className="block truncate">
                    {uses.map((use) => t(`useNames.${use}`)).join(", ")}
                  </span>
                )
              }
            </Select.Value>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox selectionMode="multiple">
              {DECISION_USES.map((use) => (
                <ListBox.Item key={use} id={use} textValue={t(`useNames.${use}`)}>
                  <div className="flex flex-col">
                    <span>{t(`useNames.${use}`)}</span>
                    <span className="text-muted text-xs">{t(`useNames.${use}Description`)}</span>
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </SettingRow>

      {enabled && !aiEnabled && <p className="text-muted text-xs">{t("aiDisabledHint")}</p>}

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

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <Button
          isDisabled={!enabled || !aiEnabled || !hasConnection}
          onPress={handleTest}
          variant="tertiary"
          isPending={testing}
        >
          {<BeakerIcon className="h-5 w-5" />}
          {t("testConnection")}
        </Button>
        <Button
          isDisabled={!hasChanges || !hasConnection}
          onPress={handleSave}
          variant="primary"
          isPending={saving}
        >
          {tActions("save")}
        </Button>
      </div>
    </div>
  );
}
