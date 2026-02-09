"use client";

import {
  Card,
  CardBody,
  CardHeader,
  Accordion,
  AccordionItem,
  Switch,
  Divider,
} from "@heroui/react";
import { KeyIcon } from "@heroicons/react/24/outline";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { useAdminSettingsContext } from "../../context";
import { RestartRequiredChip } from "../restart-required-chip";
import { UnsavedChangesChip } from "../unsaved-changes-chip";

import { AuthProviderForm } from "./auth-provider-form";
import { OIDCProviderForm } from "./oidc-provider-form";
import { EnvManagedBadge } from "./env-managed-badge";

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
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyIcon className="h-5 w-5" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <RestartRequiredChip />
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <p className="text-default-500 text-base">{t("description")}</p>

        {/* Password Auth Toggle */}
        <div className="bg-default-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{t("passwordAuth.title")}</span>
                <span className="text-default-500 text-base">{t("passwordAuth.description")}</span>
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

        <p className="text-default-500 text-base">{t("oauthDescription")}</p>

        {/* OAuth Providers Accordion */}
        <Accordion selectionMode="multiple" variant="bordered">
          <AccordionItem
            key="oidc"
            subtitle={t("oidc.subtitle")}
            title={
              <span className="flex items-center gap-2">
                {t("oidc.title")} <EnvManagedBadge isOverridden={authProviderOIDC?.isOverridden} />
                {dirtySections.oidc && <UnsavedChangesChip />}
              </span>
            }
          >
            <OIDCProviderForm
              config={authProviderOIDC as Record<string, unknown> | undefined}
              onDirtyChange={updateDirtySection("oidc")}
            />
          </AccordionItem>

          <AccordionItem
            key="github"
            subtitle={t("github.subtitle")}
            title={
              <span className="flex items-center gap-2">
                {t("github.title")}{" "}
                <EnvManagedBadge isOverridden={authProviderGitHub?.isOverridden} />
                {dirtySections.github && <UnsavedChangesChip />}
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
              onDirtyChange={updateDirtySection("github")}
            />
          </AccordionItem>

          <AccordionItem
            key="google"
            subtitle={t("google.subtitle")}
            title={
              <span className="flex items-center gap-2">
                {t("google.title")}{" "}
                <EnvManagedBadge isOverridden={authProviderGoogle?.isOverridden} />
                {dirtySections.google && <UnsavedChangesChip />}
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
              onDirtyChange={updateDirtySection("google")}
            />
          </AccordionItem>
        </Accordion>
      </CardBody>
    </Card>
  );
}
