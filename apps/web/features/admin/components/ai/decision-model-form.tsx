"use client";

import { useState } from "react";
import { SettingRow } from "@/components/settings/setting-row";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import SecretInput from "@/components/shared/secret-input";
import { usePending } from "@/hooks/use-pending";
import { Description, Input, Label, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { DecisionProvider, DecisionUse } from "@norish/config/zod/server-config";
import type { WriteResult } from "@norish/shared-react/admin";
import {
  DECISION_USES,
  DEFAULT_DECISION_ENDPOINT,
  DEFAULT_DECISION_MODEL,
  selectedDecisionUses,
  ServerConfigKeys,
} from "@norish/config/zod/server-config";
import {
  useAdminConfig,
  useConfigSecret,
  useDecisionConfigWrite,
} from "@norish/shared-react/admin";

import { ConnectionTestResult } from "../connection-test-result";
import { KindsSelect } from "../kinds-select";
import { useReportDirty } from "../use-report-dirty";
import { ProviderSelect } from "./provider-select";

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
  const decisionConfig = useAdminConfig(ServerConfigKeys.DECISION_CONFIG);
  const { save: updateDecisionConfig, test: testDecisionEndpoint } = useDecisionConfigWrite();
  const fetchConfigSecret = useConfigSecret();
  const [provider, setProvider] = useState<DecisionProvider>(
    decisionConfig?.provider ?? "disabled"
  );
  // The model is prefilled rather than defaulted behind a placeholder: the one
  // sensible value is on screen, and clearing it still resolves to the same.
  const [model, setModel] = useState(decisionConfig?.model ?? DEFAULT_DECISION_MODEL);
  const [endpoint, setEndpoint] = useState(decisionConfig?.endpoint ?? "");
  const [apiKey, setApiKey] = useState("");
  // No stored list means every use, as a fresh block starts.
  const [uses, setUses] = useState<DecisionUse[]>(decisionConfig?.uses ?? [...DECISION_USES]);
  const [testing, whileTesting] = usePending();
  const [testResult, setTestResult] = useState<WriteResult | null>(null);
  const [saving, whileSaving] = usePending();

  const [prevDecisionConfig, setPrevDecisionConfig] = useState(decisionConfig);

  if (decisionConfig !== prevDecisionConfig) {
    setPrevDecisionConfig(decisionConfig);
    if (decisionConfig) {
      setProvider(decisionConfig.provider);
      setModel(decisionConfig.model ?? DEFAULT_DECISION_MODEL);
      setEndpoint(decisionConfig.endpoint ?? "");
      setUses(decisionConfig.uses ?? [...DECISION_USES]);
    }
  }

  const enabled = provider !== "disabled";
  // This block never borrows the AI configuration's key — the provider never
  // matches — so a stored key is only ever its own.
  const hasStoredApiKey = !!decisionConfig?.apiKey && decisionConfig.provider === provider;

  const hasChanges =
    provider !== (decisionConfig?.provider ?? "disabled") ||
    model !== (decisionConfig?.model ?? DEFAULT_DECISION_MODEL) ||
    endpoint !== (decisionConfig?.endpoint ?? "") ||
    apiKey.trim() !== "" ||
    !sameUses(uses, decisionConfig?.uses ?? DECISION_USES);

  useReportDirty(hasChanges, onDirtyChange);

  const handleRevealApiKey = () => fetchConfigSecret(ServerConfigKeys.DECISION_CONFIG, "apiKey");

  const handleProviderChange = (newProvider: DecisionProvider) => {
    if (newProvider === provider) return;
    setProvider(newProvider);
    // A key is issued by a provider and only that provider accepts it.
    setApiKey("");
    setTestResult(null);
  };

  const handleTest = async () => {
    setTestResult(null);
    await whileTesting(() =>
      testDecisionEndpoint({
        provider,
        apiKey: apiKey || undefined,
        model: model || undefined,
        endpoint: endpoint.trim() || undefined,
      }).then(setTestResult)
    );
  };

  const handleSave = async () => {
    await whileSaving(() =>
      updateDecisionConfig({
        provider,
        model: model || undefined,
        endpoint: endpoint.trim() || undefined,
        // An empty key preserves the stored one on the server.
        apiKey: apiKey || undefined,
        // Every use selected is stored as no list, so the block keeps meaning
        // "every use" and a use added later is on for it (ADR-0035).
        uses: selectedDecisionUses(uses),
      }).then((answer) => {
        if (answer) setApiKey("");
      })
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <ProviderSelect
        label={t("provider")}
        messages="settings.admin.decisionConfig.providers"
        options={PROVIDER_OPTIONS}
        value={provider}
        onChange={handleProviderChange}
      />

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

          <TextField value={endpoint} onChange={setEndpoint}>
            <Label>{t("endpoint")}</Label>
            <Input placeholder={DEFAULT_DECISION_ENDPOINT} variant="secondary" />
            <Description>{t("endpointDescription")}</Description>
          </TextField>
        </>
      )}

      <SettingRow title={t("uses")}>
        <KindsSelect
          isDisabled={!enabled}
          label={t("uses")}
          options={DECISION_USES.map((use) => ({
            id: use,
            label: t(`useNames.${use}`),
            description: t(`useNames.${use}Description`),
          }))}
          placeholder={t("usesPlaceholder")}
          value={uses}
          onChange={setUses}
        />
      </SettingRow>

      <ConnectionTestResult result={testResult} successLabel={t("connectionSuccess")} />

      <ActionButtonGroup className="pt-2">
        <ActionButton action="test" isDisabled={!enabled} isPending={testing} onPress={handleTest}>
          {tActions("test")}
        </ActionButton>
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
