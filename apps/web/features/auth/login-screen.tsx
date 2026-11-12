"use client";

import { Separator } from "@heroui/react";
import { useTranslations } from "next-intl";

import type { ProviderInfo } from "@norish/shared/contracts";
import { APP_ROOT } from "@norish/shared/lib/base-path";

import { AuthAlert } from "./components/auth-alert";
import { AuthCard } from "./components/auth-card";
import { AutoSignIn } from "./components/auto-sign-in";
import { EmailPasswordForm } from "./components/email-password-form";
import { ProviderButton } from "./components/provider-button";
import { useForgetEndedSession } from "./use-forget-ended-session";

interface LoginScreenProps {
  providers: ProviderInfo[];
  callbackUrl?: string;
  autoSignInProvider?: ProviderInfo;
  registrationEnabled?: boolean;
  /** Sent here from a signed-in page whose session the server no longer knows. */
  sessionEnded?: boolean;
}

export function LoginScreen({
  providers,
  callbackUrl = APP_ROOT,
  autoSignInProvider,
  registrationEnabled = false,
  sessionEnded = false,
}: LoginScreenProps) {
  const t = useTranslations("auth.login");

  useForgetEndedSession(sessionEnded);

  if (autoSignInProvider) {
    return <AutoSignIn callbackUrl={callbackUrl} provider={autoSignInProvider} />;
  }

  const hasCredential = providers.some((p) => p.type === "credential");
  const oauthProviders = providers.filter((p) => p.type !== "credential");
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
      title={t("heading")}
    >
      {hasCredential && (
        <EmailPasswordForm callbackUrl={callbackUrl} registrationEnabled={registrationEnabled} />
      )}

      {hasCredential && hasOAuth && (
        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-muted text-sm">{t("divider")}</span>
          <Separator className="flex-1" />
        </div>
      )}

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

      {/* No providers configured: a deployment problem, not rejected credentials */}
      {!hasCredential && !hasOAuth && (
        <AuthAlert
          description={t("noProviders.contactAdmin")}
          status="warning"
          title={t("noProviders.title")}
        />
      )}
    </AuthCard>
  );
}
