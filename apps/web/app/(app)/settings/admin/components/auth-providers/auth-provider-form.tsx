"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SecretInput from "@/components/shared/secret-input";
import { usePending } from "@/hooks/use-pending";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { Input, Label, TextField, useOverlayState } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { ServerConfigKey } from "@norish/config/zod/server-config";
import { ServerConfigKeys } from "@norish/config/zod/server-config";

import type { FieldDef, ProviderKey, TestResult } from "./types";
import { useAdminSettingsContext } from "../../context";
import { DeleteProviderModal } from "./delete-provider-modal";
import { ProviderActions } from "./provider-actions";
import { TestResultDisplay } from "./test-result-display";

const CONFIG_KEYS: Record<ProviderKey, ServerConfigKey> = {
  oidc: ServerConfigKeys.AUTH_PROVIDER_OIDC,
  github: ServerConfigKeys.AUTH_PROVIDER_GITHUB,
  google: ServerConfigKeys.AUTH_PROVIDER_GOOGLE,
};

interface AuthProviderFormProps {
  providerKey: ProviderKey;
  providerName: string;
  config: Record<string, unknown> | undefined;
  fields: FieldDef[];
  onDirtyChange?: (isDirty: boolean) => void;
}

export function AuthProviderForm({
  providerKey,
  providerName,
  config,
  fields,
  onDirtyChange,
}: AuthProviderFormProps) {
  const tErrors = useTranslations("common.errors");
  const {
    updateAuthProviderGitHub,
    updateAuthProviderGoogle,
    deleteAuthProvider,
    testAuthProvider,
    fetchConfigSecret,
  } = useAdminSettingsContext();

  // Initialize form values from config (secrets start empty)
  const [values, setValues] = useState<Record<string, string>>(() =>
    fields.reduce(
      (acc, f) => {
        acc[f.key] = f.secret ? "" : ((config?.[f.key] as string) ?? "");

        return acc;
      },
      {} as Record<string, string>
    )
  );
  const [testing, whileTesting] = usePending();
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saving, whileSaving] = usePending();
  const deleteModal = useOverlayState();

  const hasChanges = useMemo(
    () =>
      fields.some((field) => {
        const value = values[field.key] ?? "";

        if (field.secret) {
          return value.trim() !== "";
        }

        return value !== ((config?.[field.key] as string) ?? "");
      }),
    [fields, values, config]
  );

  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  const handleRevealSecret = useCallback(
    (field: string) => () => fetchConfigSecret(CONFIG_KEYS[providerKey], field),
    [fetchConfigSecret, providerKey]
  );

  const handleTest = async () => {
    setTestResult(null);
    const testValues = Object.fromEntries(fields.map((f) => [f.key, values[f.key] || undefined]));

    await whileTesting(() => testAuthProvider(providerKey, testValues).then(setTestResult));
  };

  const handleSave = async () => {
    const save = async () => {
      const saveValues = Object.fromEntries(fields.map((f) => [f.key, values[f.key] || undefined]));

      // Route to correct update function (OIDC uses OIDCProviderForm, not this generic form)
      if (providerKey === "github") {
        await updateAuthProviderGitHub(
          saveValues as Parameters<typeof updateAuthProviderGitHub>[0]
        );
      } else if (providerKey === "google") {
        await updateAuthProviderGoogle(
          saveValues as Parameters<typeof updateAuthProviderGoogle>[0]
        );
      }
      // Saved secrets live on the server, not in the form: a secret left in
      // state reads as an unsaved change on every later render.
      setValues((prev) => {
        const cleared = { ...prev };

        for (const field of fields) {
          if (field.secret) cleared[field.key] = "";
        }

        return cleared;
      });
    };

    await whileSaving(() => save());
  };

  const handleDelete = async () => {
    const result = await deleteAuthProvider(providerKey);

    if (!result.success) {
      deleteModal.close();
      showSafeErrorToast({
        title: tErrors("operationFailed"),
        description: tErrors("technicalDetails"),
        error: result.error,
        context: `admin-auth-provider:delete:${providerKey}`,
      });

      return;
    }

    deleteModal.close();
    setValues(
      fields.reduce(
        (acc, f) => {
          acc[f.key] = "";

          return acc;
        },
        {} as Record<string, string>
      )
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) =>
        field.secret ? (
          <SecretInput
            key={field.key}
            isConfigured={!!config?.[field.key]}
            label={field.label}
            placeholder={field.placeholder}
            value={values[field.key] ?? ""}
            onReveal={handleRevealSecret(field.key)}
            onValueChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
          />
        ) : (
          <TextField
            key={field.key}
            value={values[field.key] ?? ""}
            onChange={(value) => setValues((prev) => ({ ...prev, [field.key]: value }))}
          >
            <Label>{field.label}</Label>
            <Input variant="secondary" placeholder={field.placeholder} />
          </TextField>
        )
      )}

      <TestResultDisplay result={testResult} />

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
        providerName={providerName}
        onClose={deleteModal.close}
        onConfirm={handleDelete}
      />
    </div>
  );
}
