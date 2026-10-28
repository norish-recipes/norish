"use client";

import { useState } from "react";
import { SwitchRow } from "@/app/(app)/settings/components/setting-row";
import { SettingsCard } from "@/app/(app)/settings/components/settings-card";
import SettingsSwitch from "@/app/(app)/settings/components/settings-switch";
import { useTRPC } from "@/app/providers/trpc-provider";
import { ActionButton, ActionButtonGroup } from "@/components/shared/action-button";
import SecretInput from "@/components/shared/secret-input";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { BeakerIcon, TrashIcon } from "@heroicons/react/16/solid";
import { GlobeAltIcon } from "@heroicons/react/24/outline";
import { Button, Description, Input, Label, Separator, TextField, toast } from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { PageRenderersConfig } from "@norish/config/zod/server-config";

import { ConnectionTestResult } from "./connection-test-result";
import { UnsavedChangesChip } from "./unsaved-changes-chip";

const DEFAULT_TIMEOUT_MS = 45_000;
// These answer on the private compose network, without TLS.
// eslint-disable-next-line sonarjs/no-clear-text-protocols -- placeholder for the shipped service
const OBSCURA_PLACEHOLDER = "ws://obscura:9222";
// eslint-disable-next-line sonarjs/no-clear-text-protocols -- default for the commented-out service
const CHROMIUM_DEFAULT = "http://chromium:9222";
// eslint-disable-next-line sonarjs/no-clear-text-protocols -- default for the commented-out service
const SOLVER_DEFAULT = "http://flaresolverr:8191/v1";

/** The form's copy of the setting: every field a string or switch, the token as typed. */
function formFrom(config: PageRenderersConfig | null | undefined) {
  return {
    obscuraEnabled: config?.obscura.enabled ?? false,
    obscuraEndpoint: config?.obscura.endpoint ?? "",
    cdpToken: "",
    cdpTokenCleared: false,
    chromiumEnabled: config?.chromium.enabled ?? false,
    chromiumEndpoint: config?.chromium.endpoint ?? "",
    solverEnabled: config?.solver.enabled ?? false,
    solverEndpoint: config?.solver.endpoint ?? "",
    allowPrivateAddresses: config?.allowPrivateAddresses ?? false,
    navigationTimeoutMs: String(config?.navigationTimeoutMs ?? DEFAULT_TIMEOUT_MS),
  };
}

/** Obscura, a Chromium browser and a FlareSolverr-compatible solver, tried in that order (ADR-0019). */
export default function PageRenderersCard() {
  const t = useTranslations("settings.admin.pageRenderers");
  const tActions = useTranslations("common.actions");
  const tErrors = useTranslations("common.errors");
  const trpc = useTRPC();
  const stored = useQuery(trpc.admin.getPageRenderers.queryOptions());
  const [form, setForm] = useState(() => formFrom(stored.data));
  const [prevStored, setPrevStored] = useState(stored.data);

  if (stored.data !== prevStored) {
    setPrevStored(stored.data);
    setForm(formFrom(stored.data));
  }

  const save = useMutation(
    trpc.admin.updatePageRenderers.mutationOptions({
      onSuccess: () => {
        toast(t("saved"), { variant: "success" });
        void stored.refetch();
      },
      onError: (error) =>
        showSafeErrorToast({
          title: t("error"),
          description: tErrors("technicalDetails"),
          color: "danger",
          error,
          context: "admin-page-renderers:save",
        }),
    })
  );

  const set =
    <K extends keyof typeof form>(key: K) =>
    (value: (typeof form)[K]) =>
      setForm((current) => ({ ...current, [key]: value }));
  const initial = formFrom(stored.data);
  const isDirty = (Object.keys(form) as (keyof typeof form)[]).some(
    (key) => form[key] !== initial[key]
  );
  // The server drops the token for another endpoint, so only the stored one keeps it.
  const keepsStoredToken =
    !!stored.data?.obscura.cdpToken &&
    !form.cdpTokenCleared &&
    form.obscuraEndpoint.trim() === stored.data.obscura.endpoint;

  const handleSave = () =>
    save.mutate({
      obscura: {
        enabled: form.obscuraEnabled,
        endpoint: form.obscuraEndpoint.trim(),
        // Omitted keeps the stored token on the server; an empty one clears it.
        cdpToken: form.cdpToken || (form.cdpTokenCleared ? "" : undefined),
      },
      chromium: { enabled: form.chromiumEnabled, endpoint: form.chromiumEndpoint.trim() },
      solver: {
        enabled: form.solverEnabled,
        endpoint: form.solverEndpoint.trim() || undefined,
      },
      allowPrivateAddresses: form.allowPrivateAddresses,
      navigationTimeoutMs: parseInt(form.navigationTimeoutMs) || DEFAULT_TIMEOUT_MS,
    });

  return (
    <SettingsCard
      badges={isDirty ? <UnsavedChangesChip /> : null}
      contentClassName="gap-6"
      data-testid="page-renderers-card"
      description={t("description")}
      icon={GlobeAltIcon}
      title={t("title")}
    >
      <SwitchRow description={t("obscuraDescription")} title={t("obscura")}>
        <SettingsSwitch
          aria-label={t("obscura")}
          isDisabled={stored.isLoading}
          isSelected={form.obscuraEnabled}
          onValueChange={set("obscuraEnabled")}
        />
      </SwitchRow>
      {form.obscuraEnabled && (
        <>
          <TextField value={form.obscuraEndpoint} onChange={set("obscuraEndpoint")}>
            <Label>{t("obscuraEndpoint")}</Label>
            <Input placeholder={OBSCURA_PLACEHOLDER} variant="secondary" />
          </TextField>
          <div className="flex flex-col items-start gap-2">
            <SecretInput
              className="w-full"
              description={t("cdpTokenDescription")}
              isConfigured={keepsStoredToken}
              label={t("cdpToken")}
              placeholder=""
              value={form.cdpToken}
              onValueChange={set("cdpToken")}
            />
            {keepsStoredToken && (
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => setForm((f) => ({ ...f, cdpToken: "", cdpTokenCleared: true }))}
              >
                <TrashIcon className="size-4" />
                {tActions("clear")}
              </Button>
            )}
          </div>
        </>
      )}

      <Separator />

      <TestedRenderer
        defaultEndpoint={CHROMIUM_DEFAULT}
        enabled={form.chromiumEnabled}
        endpoint={form.chromiumEndpoint}
        isLoading={stored.isLoading}
        renderer="chromium"
        onEnabledChange={set("chromiumEnabled")}
        onEndpointChange={set("chromiumEndpoint")}
      />

      <Separator />

      <TestedRenderer
        defaultEndpoint={SOLVER_DEFAULT}
        enabled={form.solverEnabled}
        endpoint={form.solverEndpoint}
        isLoading={stored.isLoading}
        renderer="solver"
        onEnabledChange={set("solverEnabled")}
        onEndpointChange={set("solverEndpoint")}
      />

      <Separator />

      <SwitchRow
        description={t("allowPrivateAddressesDescription")}
        title={t("allowPrivateAddresses")}
      >
        <SettingsSwitch
          aria-label={t("allowPrivateAddresses")}
          isDisabled={stored.isLoading}
          isSelected={form.allowPrivateAddresses}
          onValueChange={set("allowPrivateAddresses")}
        />
      </SwitchRow>

      <TextField
        type="number"
        value={form.navigationTimeoutMs}
        onChange={set("navigationTimeoutMs")}
      >
        <Label>{t("navigationTimeout")}</Label>
        <Input min={1} variant="secondary" />
        <Description>{t("navigationTimeoutDescription")}</Description>
      </TextField>

      <ActionButtonGroup>
        <ActionButton
          action="save"
          isDisabled={!isDirty}
          isPending={save.isPending}
          onPress={handleSave}
        >
          {tActions("save")}
        </ActionButton>
      </ActionButtonGroup>
    </SettingsCard>
  );
}

/**
 * The Chromium browser or the solver: its switch, its endpoint and a Test connection. Switching it
 * on fills in the compose service's endpoint when there is none, and tests it.
 */
function TestedRenderer({
  renderer,
  defaultEndpoint,
  enabled,
  endpoint,
  isLoading,
  onEnabledChange,
  onEndpointChange,
}: {
  renderer: "chromium" | "solver";
  defaultEndpoint: string;
  enabled: boolean;
  endpoint: string;
  isLoading: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onEndpointChange: (endpoint: string) => void;
}) {
  const t = useTranslations("settings.admin.pageRenderers");
  const trpc = useTRPC();
  const test = useMutation(trpc.admin.testPageRenderer.mutationOptions());

  const handleSwitch = (on: boolean) => {
    onEnabledChange(on);
    test.reset();
    if (!on) return;
    const filled = endpoint.trim() || defaultEndpoint;

    onEndpointChange(filled);
    test.mutate({ renderer, endpoint: filled });
  };

  return (
    <>
      <SwitchRow description={t(`${renderer}Description`)} title={t(renderer)}>
        <SettingsSwitch
          aria-label={t(renderer)}
          isDisabled={isLoading}
          isSelected={enabled}
          onValueChange={handleSwitch}
        />
      </SwitchRow>
      {enabled && (
        <div className="flex flex-col gap-2">
          <TextField
            value={endpoint}
            onChange={(value) => {
              onEndpointChange(value);
              test.reset();
            }}
          >
            <Label>{t(`${renderer}Endpoint`)}</Label>
            <Input placeholder={defaultEndpoint} variant="secondary" />
          </TextField>
          <ConnectionTestResult
            result={test.error ? { success: false, error: test.error.message } : test.data}
            successLabel={t("connectionSuccess")}
          />
          <Button
            className="self-start"
            isDisabled={!endpoint.trim()}
            isPending={test.isPending}
            size="sm"
            variant="tertiary"
            onPress={() => test.mutate({ renderer, endpoint: endpoint.trim() })}
          >
            <BeakerIcon className="size-4" />
            {t("testConnection")}
          </Button>
        </div>
      )}
    </>
  );
}
