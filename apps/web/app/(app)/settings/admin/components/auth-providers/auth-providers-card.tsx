"use client";

import { useCallback, useState } from "react";
import SettingsSwitch from "@/app/(app)/settings/components/settings-switch";
import { KeyIcon } from "@heroicons/react/24/outline";
import { Accordion, Card, Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useAdminSettingsContext } from "../../context";
import { RestartRequiredChip } from "../restart-required-chip";
import { UnsavedChangesChip } from "../unsaved-changes-chip";
import { AuthProviderForm } from "./auth-provider-form";
import { EnvManagedBadge } from "./env-managed-badge";
import { OIDCProviderForm } from "./oidc-provider-form";

export function AuthProvidersCard() {
  const t = useTranslations("settings.admin.authProviders");
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
  const [dirtySections, setDirtySections] = useState({ oidc: false, github: false, google: false });

  const updateDirtySection = useCallback(
    (section: keyof typeof dirtySections) => (isDirty: boolean) => {
      setDirtySections((current) =>
        current[section] === isDirty ? current : { ...current, [section]: isDirty }
      );
    },
    []
  );

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center gap-2">
          <KeyIcon className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <RestartRequiredChip />
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <p className="text-muted text-base">{t("description")}</p>

        {/* Password Auth Toggle */}
        <div className="bg-surface-secondary rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{t("passwordAuth.title")}</span>
                <span className="text-muted text-base">{t("passwordAuth.description")}</span>
              </div>
            </div>
            <SettingsSwitch
              color="success"
              isDisabled={isLoading}
              isSelected={passwordAuthEnabled ?? false}
              onValueChange={updatePasswordAuth}
            />
          </div>
        </div>

        <Separator />

        <p className="text-muted text-base">{t("oauthDescription")}</p>

        {/* OAuth Providers Accordion */}
        <Accordion allowsMultipleExpanded variant="surface">
          <Accordion.Item id="oidc">
            <Accordion.Heading>
              <Accordion.Trigger>
                <div className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-2">
                    {t("oidc.title")}{" "}
                    <EnvManagedBadge isOverridden={authProviderOIDC?.isOverridden} />
                    {dirtySections.oidc && <UnsavedChangesChip />}
                  </span>
                  <span className="text-muted text-sm">{t("oidc.subtitle")}</span>
                </div>
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>
                <OIDCProviderForm
                  config={authProviderOIDC as Record<string, unknown> | undefined}
                  onDirtyChange={updateDirtySection("oidc")}
                />
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item id="github">
            <Accordion.Heading>
              <Accordion.Trigger>
                <div className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-2">
                    {t("github.title")}{" "}
                    <EnvManagedBadge isOverridden={authProviderGitHub?.isOverridden} />
                    {dirtySections.github && <UnsavedChangesChip />}
                  </span>
                  <span className="text-muted text-sm">{t("github.subtitle")}</span>
                </div>
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>
                <AuthProviderForm
                  config={authProviderGitHub as Record<string, unknown> | undefined}
                  fields={[
                    { key: "clientId", label: tGithub("clientId") },
                    { key: "clientSecret", label: tGithub("clientSecret"), secret: true },
                  ]}
                  providerKey="github"
                  providerName={t("github.title")}
                  onDirtyChange={updateDirtySection("github")}
                />
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item id="google">
            <Accordion.Heading>
              <Accordion.Trigger>
                <div className="flex flex-col items-start gap-1">
                  <span className="flex items-center gap-2">
                    {t("google.title")}{" "}
                    <EnvManagedBadge isOverridden={authProviderGoogle?.isOverridden} />
                    {dirtySections.google && <UnsavedChangesChip />}
                  </span>
                  <span className="text-muted text-sm">{t("google.subtitle")}</span>
                </div>
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body>
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
                  onDirtyChange={updateDirtySection("google")}
                />
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Card.Content>
    </Card>
  );
}
