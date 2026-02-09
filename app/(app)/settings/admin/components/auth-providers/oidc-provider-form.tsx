"use client";

import type { TestResult } from "./types";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Input, useDisclosure, addToast } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useAdminSettingsContext } from "../../context";

import { DeleteProviderModal } from "./delete-provider-modal";
import { ProviderActions } from "./provider-actions";
import { TestResultDisplay } from "./test-result-display";
import { OIDCClaimMapping, type ClaimMappingValues } from "./oidc-claim-mapping";

import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";
import SecretInput from "@/components/shared/secret-input";
import { useDirtyState } from "@/hooks/use-dirty-state";

interface OIDCProviderFormProps {
  config: Record<string, unknown> | undefined;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function OIDCProviderForm({ config, onDirtyChange }: OIDCProviderFormProps) {
  const tOidc = useTranslations("settings.admin.authProviders.oidc.fields");
  const { updateAuthProviderOIDC, deleteAuthProvider, testAuthProvider, fetchConfigSecret } =
    useAdminSettingsContext();

  // Get existing claim config
  const existingClaimConfig = config?.claimConfig as
    | {
        enabled?: boolean;
        scopes?: string[];
        groupsClaim?: string;
        adminGroup?: string;
        householdPrefix?: string;
      }
    | undefined;

  // Core OIDC fields
  const [name, setName] = useState((config?.name as string) ?? "");
  const [issuer, setIssuer] = useState((config?.issuer as string) ?? "");
  const [clientId, setClientId] = useState((config?.clientId as string) ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [wellknown, setWellknown] = useState((config?.wellknown as string) ?? "");

  // Claim mapping state
  const [claimMapping, setClaimMapping] = useState<ClaimMappingValues>({
    enabled: existingClaimConfig?.enabled ?? false,
    scopes: existingClaimConfig?.scopes?.join(", ") ?? "",
    groupsClaim: existingClaimConfig?.groupsClaim ?? "groups",
    adminGroup: existingClaimConfig?.adminGroup ?? "norish_admin",
    householdPrefix: existingClaimConfig?.householdPrefix ?? "norish_household_",
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const deleteModal = useDisclosure();

  const configClaim = config?.claimConfig as
    | {
        enabled?: boolean;
        scopes?: string[];
        groupsClaim?: string;
        adminGroup?: string;
        householdPrefix?: string;
      }
    | undefined;

  const hasClaimMappingChanges = useDirtyState(claimMapping, configClaim, {
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

  const hasChanges = useMemo(() => {
    const configName = (config?.name as string) ?? "";
    const configIssuer = (config?.issuer as string) ?? "";
    const configClientId = (config?.clientId as string) ?? "";
    const configWellknown = (config?.wellknown as string) ?? "";

    return (
      name !== configName ||
      issuer !== configIssuer ||
      clientId !== configClientId ||
      wellknown !== configWellknown ||
      clientSecret.trim() !== "" ||
      hasClaimMappingChanges
    );
  }, [config, name, issuer, clientId, clientSecret, wellknown, hasClaimMappingChanges]);

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  const handleRevealSecret = useCallback(
    (field: string) => () => fetchConfigSecret(ServerConfigKeys.AUTH_PROVIDER_OIDC, field),
    [fetchConfigSecret]
  );

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const testValues = {
        name: name || undefined,
        issuer: issuer || undefined,
        clientId: clientId || undefined,
        clientSecret: clientSecret || undefined,
        wellknown: wellknown || undefined,
      };

      setTestResult(await testAuthProvider("oidc", testValues));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Parse scopes from comma-separated string
      const scopesArray = claimMapping.scopes
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await updateAuthProviderOIDC({
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
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const result = await deleteAuthProvider("oidc");

    if (!result.success) {
      deleteModal.onClose();
      addToast({
        severity: "danger",
        title: "Cannot delete provider",
        description: result.error,
      });

      return;
    }

    deleteModal.onClose();
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
    <div className="flex flex-col gap-4 p-2">
      {/* Core OIDC Fields */}
      <Input
        label={tOidc("name")}
        placeholder={tOidc("namePlaceholder")}
        value={name}
        onValueChange={setName}
      />
      <Input
        label={tOidc("issuer")}
        placeholder={tOidc("issuerPlaceholder")}
        value={issuer}
        onValueChange={setIssuer}
      />
      <Input label={tOidc("clientId")} value={clientId} onValueChange={setClientId} />
      <SecretInput
        isConfigured={!!config?.clientSecret}
        label={tOidc("clientSecret")}
        value={clientSecret}
        onReveal={handleRevealSecret("clientSecret")}
        onValueChange={setClientSecret}
      />
      <Input
        label={tOidc("wellknown")}
        placeholder={tOidc("wellknownPlaceholder")}
        value={wellknown}
        onValueChange={setWellknown}
      />

      {/* Claim Mapping Section */}
      <OIDCClaimMapping
        isDirty={hasClaimMappingChanges}
        values={claimMapping}
        onChange={setClaimMapping}
      />

      <TestResultDisplay result={testResult} />

      <ProviderActions
        hasChanges={hasChanges}
        hasConfig={!!config}
        saving={saving}
        testing={testing}
        onDeleteClick={deleteModal.onOpen}
        onSave={handleSave}
        onTest={handleTest}
      />

      <DeleteProviderModal
        isOpen={deleteModal.isOpen}
        providerName="OIDC"
        onClose={deleteModal.onClose}
        onConfirm={handleDelete}
      />
    </div>
  );
}
