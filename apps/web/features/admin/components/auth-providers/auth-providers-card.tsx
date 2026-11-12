"use client";

import { SwitchRow } from "@/components/settings/setting-row";
import { SettingsAccordion, SettingsCard } from "@/components/settings/settings-card";
import SettingsSwitch from "@/components/settings/settings-switch";
import { KeyIcon } from "@heroicons/react/24/outline";
import { Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { useAdminConfig, usePasswordAuthWrite } from "@norish/shared-react/admin";

import { AccordionSection } from "../accordion-section";
import { RestartRequiredChip } from "../restart-required-chip";
import { AuthProviderForm } from "./auth-provider-form";
import { EnvManagedBadge } from "./env-managed-badge";
import { OIDCProviderForm } from "./oidc-provider-form";

export function AuthProvidersCard() {
  const t = useTranslations("settings.admin.authProviders");
  const tGithub = useTranslations("settings.admin.authProviders.github.fields");
  const tGoogle = useTranslations("settings.admin.authProviders.google.fields");
  const authProviderOIDC = useAdminConfig(ServerConfigKeys.AUTH_PROVIDER_OIDC);
  const authProviderGitHub = useAdminConfig(ServerConfigKeys.AUTH_PROVIDER_GITHUB);
  const authProviderGoogle = useAdminConfig(ServerConfigKeys.AUTH_PROVIDER_GOOGLE);
  const passwordAuthEnabled = useAdminConfig(ServerConfigKeys.PASSWORD_AUTH_ENABLED);
  const updatePasswordAuth = usePasswordAuthWrite();

  return (
    <SettingsCard
      badges={<RestartRequiredChip />}
      description={t("description")}
      icon={KeyIcon}
      title={t("title")}
    >
      <SwitchRow description={t("passwordAuth.description")} title={t("passwordAuth.title")}>
        <SettingsSwitch
          isSelected={passwordAuthEnabled ?? false}
          onValueChange={updatePasswordAuth}
        />
      </SwitchRow>

      <Separator />

      <p className="text-muted text-base">{t("oauthDescription")}</p>

      <SettingsAccordion>
        <AccordionSection
          badges={<EnvManagedBadge isOverridden={authProviderOIDC?.isOverridden} />}
          id="oidc"
          subtitle={t("oidc.subtitle")}
          title={t("oidc.title")}
        >
          {(onDirtyChange) => (
            <OIDCProviderForm
              config={authProviderOIDC as Record<string, unknown> | undefined}
              onDirtyChange={onDirtyChange}
            />
          )}
        </AccordionSection>
        <AccordionSection
          badges={<EnvManagedBadge isOverridden={authProviderGitHub?.isOverridden} />}
          id="github"
          subtitle={t("github.subtitle")}
          title={t("github.title")}
        >
          {(onDirtyChange) => (
            <AuthProviderForm
              config={authProviderGitHub as Record<string, unknown> | undefined}
              fields={[
                { key: "clientId", label: tGithub("clientId") },
                { key: "clientSecret", label: tGithub("clientSecret"), secret: true },
              ]}
              providerKey="github"
              providerName={t("github.title")}
              onDirtyChange={onDirtyChange}
            />
          )}
        </AccordionSection>
        <AccordionSection
          badges={<EnvManagedBadge isOverridden={authProviderGoogle?.isOverridden} />}
          id="google"
          subtitle={t("google.subtitle")}
          title={t("google.title")}
        >
          {(onDirtyChange) => (
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
              onDirtyChange={onDirtyChange}
            />
          )}
        </AccordionSection>
      </SettingsAccordion>
    </SettingsCard>
  );
}
