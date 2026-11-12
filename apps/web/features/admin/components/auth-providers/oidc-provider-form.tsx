"use client";

import { useState } from "react";
import SecretInput from "@/components/shared/secret-input";
import { useDirtyState } from "@/hooks/use-dirty-state";
import { usePending } from "@/hooks/use-pending";
import { Input, Label, TextField, useOverlayState } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { AuthProviderOIDC } from "@norish/config/zod/server-config";
import type { WriteResult } from "@norish/shared-react/admin";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { useAuthProviderWrites, useConfigSecret } from "@norish/shared-react/admin";

import type { ClaimMappingValues } from "./oidc-claim-mapping";
import { ConnectionTestResult } from "../connection-test-result";
import { useReportDirty } from "../use-report-dirty";
import { DeleteProviderModal } from "./delete-provider-modal";
import { OIDCClaimMapping } from "./oidc-claim-mapping";
import { ProviderActions } from "./provider-actions";

interface OIDCProviderFormProps {
  config: AuthProviderOIDC | undefined;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function OIDCProviderForm({ config, onDirtyChange }: OIDCProviderFormProps) {
  const tOidc = useTranslations("settings.admin.authProviders.oidc.fields");
  const tForm = useTranslations("settings.admin.authProviders.form");
  const { saveOIDC, remove, test } = useAuthProviderWrites();
  const fetchConfigSecret = useConfigSecret();

  const existingClaimConfig = config?.claimConfig;

  const [name, setName] = useState(config?.name ?? "");
  const [issuer, setIssuer] = useState(config?.issuer ?? "");
  const [clientId, setClientId] = useState(config?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [wellknown, setWellknown] = useState(config?.wellknown ?? "");

  // Claim mapping state
  const [claimMapping, setClaimMapping] = useState<ClaimMappingValues>({
    enabled: existingClaimConfig?.enabled ?? false,
    scopes: existingClaimConfig?.scopes?.join(", ") ?? "",
    groupsClaim: existingClaimConfig?.groupsClaim ?? "groups",
    adminGroup: existingClaimConfig?.adminGroup ?? "norish_admin",
    householdPrefix: existingClaimConfig?.householdPrefix ?? "norish_household_",
  });

  const [testing, whileTesting] = usePending();
  const [testResult, setTestResult] = useState<WriteResult | null>(null);
  const [saving, whileSaving] = usePending();
  const deleteModal = useOverlayState();

  const hasClaimMappingChanges = useDirtyState(claimMapping, existingClaimConfig, {
    normalizeCurrent: (current) => ({
      enabled: current.enabled,
      scopes: current.scopes
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      groupsClaim: current.groupsClaim,
      adminGroup: current.adminGroup,
      householdPrefix: current.householdPrefix,
    }),
    normalizeInitial: (initial) => ({
      enabled: initial?.enabled ?? false,
      scopes: initial?.scopes ?? [],
      groupsClaim: initial?.groupsClaim ?? "groups",
      adminGroup: initial?.adminGroup ?? "norish_admin",
      householdPrefix: initial?.householdPrefix ?? "norish_household_",
    }),
  });

  const hasChanges =
    name !== (config?.name ?? "") ||
    issuer !== (config?.issuer ?? "") ||
    clientId !== (config?.clientId ?? "") ||
    wellknown !== (config?.wellknown ?? "") ||
    clientSecret.trim() !== "" ||
    hasClaimMappingChanges;

  useReportDirty(hasChanges, onDirtyChange);

  const handleRevealSecret = (field: string) => () =>
    fetchConfigSecret(ServerConfigKeys.AUTH_PROVIDER_OIDC, field);

  const handleTest = async () => {
    setTestResult(null);
    const testValues = {
      name: name || undefined,
      issuer: issuer || undefined,
      clientId: clientId || undefined,
      clientSecret: clientSecret || undefined,
      wellknown: wellknown || undefined,
    };

    await whileTesting(() => test("oidc", testValues).then(setTestResult));
  };

  const handleSave = async () => {
    // Parse scopes from comma-separated string
    const scopesArray = claimMapping.scopes
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    await whileSaving(() =>
      saveOIDC({
        name,
        issuer,
        clientId,
        clientSecret: clientSecret || undefined,
        wellknown: wellknown || undefined,
        claimConfig: {
          enabled: claimMapping.enabled,
          scopes: scopesArray,
          groupsClaim: claimMapping.groupsClaim,
          adminGroup: claimMapping.adminGroup,
          householdPrefix: claimMapping.householdPrefix,
        },
      })
        // Saved secrets live on the server, not in the form.
        .then(() => setClientSecret(""))
    );
  };

  const handleDelete = async () => {
    const removed = await remove("oidc");

    deleteModal.close();
    if (!removed) return;

    // Reset all fields
    setName("");
    setIssuer("");
    setClientId("");
    setClientSecret("");
    setWellknown("");
    setClaimMapping({
      enabled: false,
      scopes: "",
      groupsClaim: "groups",
      adminGroup: "norish_admin",
      householdPrefix: "norish_household_",
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Core OIDC Fields */}
      <TextField value={name} onChange={setName}>
        <Label>{tOidc("name")}</Label>
        <Input variant="secondary" placeholder={tOidc("namePlaceholder")} />
      </TextField>
      <TextField value={issuer} onChange={setIssuer}>
        <Label>{tOidc("issuer")}</Label>
        <Input variant="secondary" placeholder={tOidc("issuerPlaceholder")} />
      </TextField>
      <TextField value={clientId} onChange={setClientId}>
        <Label>{tOidc("clientId")}</Label>
        <Input variant="secondary" />
      </TextField>
      <SecretInput
        isConfigured={!!config?.clientSecret}
        label={tOidc("clientSecret")}
        value={clientSecret}
        onReveal={handleRevealSecret("clientSecret")}
        onValueChange={setClientSecret}
      />
      <TextField value={wellknown} onChange={setWellknown}>
        <Label>{tOidc("wellknown")}</Label>
        <Input variant="secondary" placeholder={tOidc("wellknownPlaceholder")} />
      </TextField>

      {/* Claim Mapping Section */}
      <OIDCClaimMapping
        isDirty={hasClaimMappingChanges}
        values={claimMapping}
        onChange={setClaimMapping}
      />

      <ConnectionTestResult result={testResult} successLabel={tForm("testSuccess")} />

      <ProviderActions
        hasChanges={hasChanges}
        hasConfig={!!config}
        saving={saving}
        testing={testing}
        onDeleteClick={deleteModal.open}
        onSave={handleSave}
        onTest={handleTest}
      />

      <DeleteProviderModal
        isOpen={deleteModal.isOpen}
        providerName="OIDC"
        onClose={deleteModal.close}
        onConfirm={handleDelete}
      />
    </div>
  );
}
