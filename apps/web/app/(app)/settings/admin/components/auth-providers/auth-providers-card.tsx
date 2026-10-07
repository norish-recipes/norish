"use client";

import { useCallback, useState } from "react";
import { SwitchRow } from "@/app/(app)/settings/components/setting-row";
import { SettingsAccordion, SettingsCard } from "@/app/(app)/settings/components/settings-card";
import SettingsSwitch from "@/app/(app)/settings/components/settings-switch";
import { KeyIcon } from "@heroicons/react/24/outline";
import { Accordion, Separator } from "@heroui/react";
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
    <SettingsCard
      badges={<RestartRequiredChip />}
      description={t("description")}
      icon={KeyIcon}
      title={t("title")}
    >
      <SwitchRow description={t("passwordAuth.description")} title={t("passwordAuth.title")}>
        <SettingsSwitch
          color="success"
          isDisabled={isLoading}
          isSelected={passwordAuthEnabled ?? false}
          onValueChange={updatePasswordAuth}
        />
      </SwitchRow>

      <Separator />

      <p className="text-muted text-base">{t("oauthDescription")}</p>

      {/* OAuth Providers Accordion */}
      <SettingsAccordion>
        <Accordion.Item id="oidc">
          <Accordion.Heading>
            <Accordion.Trigger>
              <div className="flex min-w-0 flex-col items-start gap-1">
                <span className="flex flex-wrap items-center gap-2">
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
              <div className="flex min-w-0 flex-col items-start gap-1">
                <span className="flex flex-wrap items-center gap-2">
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
              <div className="flex min-w-0 flex-col items-start gap-1">
                <span className="flex flex-wrap items-center gap-2">
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
      </SettingsAccordion>
    </SettingsCard>
  );
}
