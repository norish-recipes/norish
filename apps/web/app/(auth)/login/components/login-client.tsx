"use client";

import { Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { ProviderInfo } from "@norish/shared/contracts";

import { AuthCard } from "../../components/auth-card";
import { AutoSignIn } from "./auto-sign-in";
import { EmailPasswordForm } from "./email-password-form";
import { ProviderButton } from "./provider-button";

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
  const singleOauthProvider = oauthProviders[0];

  // Auto-redirect for single OAuth provider setups (only if no credential provider)
  if (autoRedirect && oauthProviders.length === 1 && !credentialProvider && singleOauthProvider) {
    return <AutoSignIn callbackUrl={callbackUrl} provider={singleOauthProvider} />;
  }

  const hasCredential = !!credentialProvider;
  const hasOAuth = oauthProviders.length > 0;

  return (
    <AuthCard
      footer={
        hasOAuth &&
        !hasCredential && (
          <p className="text-muted mt-6 text-center text-sm">{t("redirectMessage")}</p>
        )
      }
      subtitle={t("subtitle")}
      title={t("title")}
    >
      {/* Email/Password form */}
      {hasCredential && (
        <EmailPasswordForm callbackUrl={callbackUrl} registrationEnabled={registrationEnabled} />
      )}

      {/* Separator between form and OAuth */}
      {hasCredential && hasOAuth && (
        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-muted text-sm">{t("divider")}</span>
          <Separator className="flex-1" />
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
          <p className="text-danger text-sm">{t("noProviders.title")}</p>
          <p className="text-muted mt-2 text-xs">{t("noProviders.contactAdmin")}</p>
        </div>
      )}
    </AuthCard>
  );
}
