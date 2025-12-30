"use client";

import type { ProviderInfo } from "@/types";

import { Divider } from "@heroui/react";
import { useTranslations } from "next-intl";

import { AuthCard } from "../../components/auth-card";

import { ProviderButton } from "./provider-button";
import { AutoSignIn } from "./auto-sign-in";
import { EmailPasswordForm } from "./email-password-form";

interface LoginClientProps {
  providers: ProviderInfo[];
  callbackUrl?: string;
  autoRedirect?: boolean;
  registrationEnabled?: boolean;
}

export function LoginClient({
  providers,
  callbackUrl = "/",
  autoRedirect = false,
  registrationEnabled = false,
}: LoginClientProps) {
  const t = useTranslations("auth.login");
  // Separate credential and OAuth providers
  const credentialProvider = providers.find((p) => p.type === "credential");
  const oauthProviders = providers.filter((p) => p.type !== "credential");

  // Auto-redirect for single OAuth provider setups (only if no credential provider)
  if (autoRedirect && oauthProviders.length === 1 && !credentialProvider) {
    return <AutoSignIn callbackUrl={callbackUrl} provider={oauthProviders[0]} />;
  }

  const hasCredential = !!credentialProvider;
  const hasOAuth = oauthProviders.length > 0;

return (
    <AuthCard
      footer={
        hasOAuth &&
        !hasCredential && (
          <p className="text-small text-default-500 mt-6 text-center">
            {t("redirectMessage")}
          </p>
        )
      }
      subtitle={t("subtitle")}
      title={t("title")}
    >
      {/* Email/Password form */}
      {hasCredential && (
        <EmailPasswordForm callbackUrl={callbackUrl} registrationEnabled={registrationEnabled} />
      )}

      {/* Divider between form and OAuth */}
      {hasCredential && hasOAuth && (
        <div className="flex items-center gap-4">
          <Divider className="flex-1" />
          <span className="text-small text-default-400">{t("divider")}</span>
          <Divider className="flex-1" />
        </div>
      )}

      {/* OAuth provider buttons */}
      {hasOAuth && (
        <div className="flex flex-col gap-3">
          {oauthProviders.map((provider) => (
            <ProviderButton
              key={provider.id}
              callbackUrl={callbackUrl}
              icon={provider.icon}
              providerId={provider.id}
              providerName={provider.name}
            />
          ))}
        </div>
      )}

      {/* No providers message */}
      {!hasCredential && !hasOAuth && (
        <div className="py-4 text-center">
          <p className="text-small text-danger">{t("noProviders.title")}</p>
          <p className="text-tiny text-default-500 mt-2">{t("noProviders.contactAdmin")}</p>
        </div>
      )}
    </AuthCard>
  );
}
