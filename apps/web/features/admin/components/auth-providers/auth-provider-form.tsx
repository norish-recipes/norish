"use client";

import { useState } from "react";
import SecretInput from "@/components/shared/secret-input";
import { usePending } from "@/hooks/use-pending";
import { Input, Label, TextField, useOverlayState } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { AuthProviderGitHub, ServerConfigKey } from "@norish/config/zod/server-config";
import type { WriteResult } from "@norish/shared-react/admin";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { useAuthProviderMutations, useConfigSecret } from "@norish/shared-react/admin";

import type { FieldDef } from "./types";
import { ConnectionTestResult } from "../connection-test-result";
import { useReportDirty } from "../use-report-dirty";
import { DeleteProviderModal } from "./delete-provider-modal";
import { ProviderActions } from "./provider-actions";

const CONFIG_KEYS: Record<"github" | "google", ServerConfigKey> = {
  github: ServerConfigKeys.AUTH_PROVIDER_GITHUB,
  google: ServerConfigKeys.AUTH_PROVIDER_GOOGLE,
};

interface AuthProviderFormProps {
  providerKey: "github" | "google";
  providerName: string;
  // GitHub and Google store the same fields.
  config: AuthProviderGitHub | undefined;
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
  const t = useTranslations("settings.admin.authProviders.form");
  const { saveGitHub, saveGoogle, remove, test } = useAuthProviderMutations();
  const fetchConfigSecret = useConfigSecret();

  // Initialize form values from config (secrets start empty)
  const [values, setValues] = useState<Record<string, string>>(() =>
    fields.reduce(
      (acc, f) => {
        acc[f.key] = f.secret ? "" : (config?.[f.key] ?? "");

        return acc;
      },
      {} as Record<string, string>
    )
  );
  const [testing, whileTesting] = usePending();
  const [testResult, setTestResult] = useState<WriteResult | null>(null);
  const [saving, whileSaving] = usePending();
  const deleteModal = useOverlayState();

  const hasChanges = fields.some((field) => {
    const value = values[field.key] ?? "";

    if (field.secret) {
      return value.trim() !== "";
    }

    return value !== (config?.[field.key] ?? "");
  });

  useReportDirty(hasChanges, onDirtyChange);

  const handleRevealSecret = (field: string) => () =>
    fetchConfigSecret(CONFIG_KEYS[providerKey], field);

  const handleTest = async () => {
    setTestResult(null);
    const testValues = Object.fromEntries(fields.map((f) => [f.key, values[f.key] || undefined]));

    await whileTesting(() => test(providerKey, testValues).then(setTestResult));
  };

  const handleSave = async () => {
    const save = async () => {
      const saveValues = {
        clientId: values.clientId ?? "",
        clientSecret: values.clientSecret || undefined,
      };

      const answer = await (providerKey === "github"
        ? saveGitHub(saveValues)
        : saveGoogle(saveValues));

      if (!answer) return;
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
    const removed = await remove(providerKey);

    deleteModal.close();
    if (!removed) return;

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

      <ConnectionTestResult result={testResult} successLabel={t("testSuccess")} />

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
