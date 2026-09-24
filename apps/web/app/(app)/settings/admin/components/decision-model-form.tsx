"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SettingRow } from "@/app/(app)/settings/components/setting-row";
import SecretInput from "@/components/shared/secret-input";
import { BeakerIcon, CheckIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { DecisionProvider, DecisionUse } from "@norish/config/zod/server-config";
import {
  DECISION_USES,
  DEFAULT_DECISION_MODEL,
  selectedDecisionUses,
  ServerConfigKeys,
} from "@norish/config/zod/server-config";

import { useAdminSettingsContext } from "../context";

interface DecisionModelFormProps {
  onDirtyChange?: (isDirty: boolean) => void;
}

/** One real provider on purpose (ADR-0035); the gateway is a second member when wanted. */
const PROVIDER_OPTIONS: DecisionProvider[] = ["disabled", "typesafe"];

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
  const [provider, setProvider] = useState<DecisionProvider>(
    decisionConfig?.provider ?? "disabled"
  );
  // The model is prefilled rather than defaulted behind a placeholder: the one
  // sensible value is on screen, and clearing it still resolves to the same.
  const [model, setModel] = useState(decisionConfig?.model ?? DEFAULT_DECISION_MODEL);
  const [apiKey, setApiKey] = useState("");
  // A stored block without a list means every use, which is also what a
  // fresh block starts with: enabling the Decision Model enables everything
  // it can do, and an administrator deselects what they do not want.
  const [uses, setUses] = useState<DecisionUse[]>(decisionConfig?.uses ?? [...DECISION_USES]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (decisionConfig) {
      setProvider(decisionConfig.provider);
      setModel(decisionConfig.model ?? DEFAULT_DECISION_MODEL);
      setUses(decisionConfig.uses ?? [...DECISION_USES]);
    }
  }, [decisionConfig]);

  const enabled = provider !== "disabled";
  const aiEnabled = aiConfig?.enabled ?? false;
  // This block never borrows the AI configuration's key — the provider never
  // matches — so a stored key is only ever its own.
  const hasStoredApiKey = !!decisionConfig?.apiKey && decisionConfig.provider === provider;

  const hasChanges = useMemo(() => {
    const stored = decisionConfig;

    return (
      provider !== (stored?.provider ?? "disabled") ||
      model !== (stored?.model ?? DEFAULT_DECISION_MODEL) ||
      apiKey.trim() !== "" ||
      !sameUses(uses, stored?.uses ?? DECISION_USES)
    );
  }, [decisionConfig, provider, model, apiKey, uses]);

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  const handleRevealApiKey = useCallback(
    () => fetchConfigSecret(ServerConfigKeys.DECISION_CONFIG, "apiKey"),
    [fetchConfigSecret]
  );

  const handleProviderChange = (newProvider: DecisionProvider) => {
    if (newProvider === provider) return;
    setProvider(newProvider);
    // A key is issued by a provider and only that provider accepts it.
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
        endpoint: decisionConfig?.endpoint,
      });

      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDecisionConfig({
        provider,
        model: model || undefined,
        // No control offers an endpoint (the default is the only one in use),
        // but one stored by other means is carried along rather than dropped.
        endpoint: decisionConfig?.endpoint,
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
    <div className="flex flex-col gap-4 p-2">
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
              <ListBox.Item key={option} id={option} textValue={t(`providers.${option}`)}>
                {t(`providers.${option}`)}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      {enabled && (
        <>
          <SecretInput
            description={t("apiKeyDescription")}
            isConfigured={hasStoredApiKey}
            label={t("apiKey")}
            placeholder={t("apiKeyPlaceholder")}
            value={apiKey}
            onReveal={handleRevealApiKey}
            onValueChange={setApiKey}
          />

          <TextField value={model} onChange={setModel}>
            <Label>{t("model")}</Label>
            <Input variant="secondary" placeholder={DEFAULT_DECISION_MODEL} />
          </TextField>
        </>
      )}

      <SettingRow title={t("uses")}>
        <Select
          aria-label={t("uses")}
          className="w-full sm:w-80"
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
          isDisabled={!enabled || !aiEnabled}
          onPress={handleTest}
          variant="tertiary"
          isPending={testing}
        >
          {<BeakerIcon className="h-5 w-5" />}
          {t("testConnection")}
        </Button>
        <Button isDisabled={!hasChanges} onPress={handleSave} variant="primary" isPending={saving}>
          {<CheckIcon className="h-5 w-5" />}
          {tActions("save")}
        </Button>
      </div>
    </div>
  );
}
