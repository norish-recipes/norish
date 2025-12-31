"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Accordion,
  AccordionItem,
  Input,
  Button,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  addToast,
  Switch,
  Divider,
} from "@heroui/react";
import {
  KeyIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useAdminSettingsContext } from "../context";

import { ServerConfigKeys, type ServerConfigKey } from "@/server/db/zodSchemas/server-config";
import SecretInput from "@/components/shared/secret-input";

type ProviderKey = "oidc" | "github" | "google";

interface FieldDef {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  optional?: boolean;
}

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
}

function AuthProviderForm({ providerKey, providerName, config, fields }: AuthProviderFormProps) {
  const t = useTranslations("settings.admin.authProviders.form");
  const tActions = useTranslations("common.actions");
  const {
    updateAuthProviderOIDC,
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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const deleteModal = useDisclosure();

  const handleRevealSecret = useCallback(
    (field: string) => () => fetchConfigSecret(CONFIG_KEYS[providerKey], field),
    [fetchConfigSecret, providerKey]
  );

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const testValues = Object.fromEntries(fields.map((f) => [f.key, values[f.key] || undefined]));

      setTestResult(await testAuthProvider(providerKey, testValues));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saveValues = Object.fromEntries(fields.map((f) => [f.key, values[f.key] || undefined]));

      // Route to correct update function
      if (providerKey === "oidc")
        await updateAuthProviderOIDC(saveValues as Parameters<typeof updateAuthProviderOIDC>[0]);
      else if (providerKey === "github")
        await updateAuthProviderGitHub(
          saveValues as Parameters<typeof updateAuthProviderGitHub>[0]
        );
      else if (providerKey === "google")
        await updateAuthProviderGoogle(
          saveValues as Parameters<typeof updateAuthProviderGoogle>[0]
        );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const result = await deleteAuthProvider(providerKey);

    if (!result.success) {
      deleteModal.onClose();
      addToast({ severity: "danger", title: "Cannot delete provider", description: result.error });

      return;
    }
    deleteModal.onClose();
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
    <div className="flex flex-col gap-4 p-2">
      {fields.map((field) =>
        field.secret ? (
          <SecretInput
            key={field.key}
            isConfigured={!!config?.[field.key]}
            label={field.label}
            placeholder={field.placeholder}
            value={values[field.key]}
            onReveal={handleRevealSecret(field.key)}
            onValueChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
          />
        ) : (
          <Input
            key={field.key}
            label={field.label}
            placeholder={field.placeholder}
            value={values[field.key]}
            onValueChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
          />
        )
      )}

      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-lg p-2 ${testResult.success ? "bg-success-100 text-success-700" : "bg-danger-100 text-danger-700"}`}
        >
          {testResult.success ? (
            <CheckIcon className="h-4 w-4" />
          ) : (
            <XMarkIcon className="h-4 w-4" />
          )}
          {testResult.success ? t("testSuccess") : testResult.error}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        {config && (
          <Button
            color="danger"
            startContent={<TrashIcon className="h-5 w-5" />}
            variant="flat"
            onPress={deleteModal.onOpen}
          >
            {tActions("remove")}
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button
            isLoading={testing}
            startContent={<BeakerIcon className="h-5 w-5" />}
            variant="flat"
            onPress={handleTest}
          >
            {tActions("test")}
          </Button>
          <Button
            color="primary"
            isLoading={saving}
            startContent={<CheckIcon className="h-5 w-5" />}
            onPress={handleSave}
          >
            {tActions("save")}
          </Button>
        </div>
      </div>

      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.onClose}>
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <ExclamationTriangleIcon className="text-danger h-5 w-5" />
            {t("removeTitle", { provider: providerName })}
          </ModalHeader>
          <ModalBody>
            <p>{t("removeConfirm")}</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={deleteModal.onClose}>
              {tActions("cancel")}
            </Button>
            <Button color="danger" onPress={handleDelete}>
              {tActions("remove")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function EnvManagedBadge({ isOverridden }: { isOverridden?: boolean }) {
  const t = useTranslations("settings.admin.authProviders.envBadge");
  if (isOverridden === undefined) return null;

  return (
    <Chip color={isOverridden ? "success" : "warning"} size="sm" variant="flat">
      {isOverridden ? t("db") : t("env")}
    </Chip>
  );
}

export default function AuthProvidersCard() {
  const t = useTranslations("settings.admin.authProviders");
  const tOidc = useTranslations("settings.admin.authProviders.oidc.fields");
  const tGithub = useTranslations("settings.admin.authProviders.github.fields");
  const tGoogle = useTranslations("settings.admin.authProviders.google.fields");
  const {
    authProviderOIDC,
    authProviderGitHub,
    authProviderGoogle,
    passwordAuthEnabled,
    updatePasswordAuth,
    isLoading,
  } = useAdminSettingsContext();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyIcon className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <Chip color="warning" size="sm" variant="flat">
            {t("requiresRestart")}
          </Chip>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <p className="text-default-500 text-base">
          {t("description")}
        </p>

        <div className="bg-default-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{t("passwordAuth.title")}</span>
                <span className="text-default-500 text-base">
                  {t("passwordAuth.description")}
                </span>
              </div>
            </div>
            <Switch
              color="success"
              isDisabled={isLoading}
              isSelected={passwordAuthEnabled ?? false}
              onValueChange={updatePasswordAuth}
            />
          </div>
        </div>

        <Divider />

        <p className="text-default-500 text-base">
          {t("oauthDescription")}
        </p>

        <Accordion selectionMode="multiple" variant="bordered">
          <AccordionItem
            key="oidc"
            subtitle={t("oidc.subtitle")}
            title={
              <span className="flex items-center gap-2">
                {t("oidc.title")} <EnvManagedBadge isOverridden={authProviderOIDC?.isOverridden} />
              </span>
            }
          >
            <AuthProviderForm
              config={authProviderOIDC as Record<string, unknown> | undefined}
              fields={[
                { key: "name", label: tOidc("name"), placeholder: tOidc("namePlaceholder") },
                { key: "issuer", label: tOidc("issuer"), placeholder: tOidc("issuerPlaceholder") },
                { key: "clientId", label: tOidc("clientId") },
                { key: "clientSecret", label: tOidc("clientSecret"), secret: true },
                {
                  key: "wellknown",
                  label: tOidc("wellknown"),
                  placeholder: tOidc("wellknownPlaceholder"),
                  optional: true,
                },
              ]}
              providerKey="oidc"
              providerName={t("oidc.title")}
            />
          </AccordionItem>
          <AccordionItem
            key="github"
            subtitle={t("github.subtitle")}
            title={
              <span className="flex items-center gap-2">
                {t("github.title")} <EnvManagedBadge isOverridden={authProviderGitHub?.isOverridden} />
              </span>
            }
          >
            <AuthProviderForm
              config={authProviderGitHub as Record<string, unknown> | undefined}
              fields={[
                { key: "clientId", label: tGithub("clientId") },
                { key: "clientSecret", label: tGithub("clientSecret"), secret: true },
              ]}
              providerKey="github"
              providerName={t("github.title")}
            />
          </AccordionItem>
          <AccordionItem
            key="google"
            subtitle={t("google.subtitle")}
            title={
              <span className="flex items-center gap-2">
                {t("google.title")} <EnvManagedBadge isOverridden={authProviderGoogle?.isOverridden} />
              </span>
            }
          >
            <AuthProviderForm
              config={authProviderGoogle as Record<string, unknown> | undefined}
              fields={[
                {
                  key: "clientId",
                  label: tGoogle("clientId"),
                  placeholder: tGoogle("clientIdPlaceholder"),
                },
                { key: "clientSecret", label: tGoogle("clientSecret"), secret: true },
              ]}
              providerKey="google"
              providerName={t("google.title")}
            />
          </AccordionItem>
        </Accordion>
      </CardBody>
    </Card>
  );
}
