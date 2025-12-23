"use client";

import type { ProviderInfo } from "@/types";

import { Divider } from "@heroui/react";

import { AuthCard } from "../../components/auth-card";

import { ProviderButton } from "./provider-button";
import { AutoSignIn } from "./auto-sign-in";
import { EmailPasswordForm } from "./email-password-form";
import { LdapForm } from "./ldap-form";

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
  // Separate credential, LDAP and OAuth providers
  const credentialProvider = providers.find((p) => p.type === "credential");
  const ldapProvider = providers.find((p) => p.type === "ldap");
  const oauthProviders = providers.filter((p) => p.type === "oauth");

  // Auto-redirect for single OAuth provider setups (only if no credential/ldap provider)
  if (autoRedirect && oauthProviders.length === 1 && !credentialProvider && !ldapProvider) {
    return <AutoSignIn callbackUrl={callbackUrl} provider={oauthProviders[0]} />;
  }

  const hasCredential = !!credentialProvider;
  const hasLdap = !!ldapProvider;
  const hasOAuth = oauthProviders.length > 0;
  const hasForm = hasCredential || hasLdap;

  return (
    <AuthCard
      footer={
        hasOAuth &&
        !hasForm && (
          <p className="text-small text-default-500 mt-6 text-center">
            You&apos;ll be securely redirected to your sign-in provider.
          </p>
        )
      }
      subtitle="Nourish every moment."
      title="Sign in to"
    >
      {/* LDAP form */}
      {hasLdap && <LdapForm callbackUrl={callbackUrl} />}

      {/* Divider between LDAP and Email/Password */}
      {hasLdap && hasCredential && (
        <div className="flex items-center gap-4">
          <Divider className="flex-1" />
          <span className="text-small text-default-400">or</span>
          <Divider className="flex-1" />
        </div>
      )}

      {/* Email/Password form */}
      {hasCredential && (
        <EmailPasswordForm callbackUrl={callbackUrl} registrationEnabled={registrationEnabled} />
      )}

      {/* Divider between forms and OAuth */}
      {hasForm && hasOAuth && (
        <div className="flex items-center gap-4">
          <Divider className="flex-1" />
          <span className="text-small text-default-400">or</span>
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
      {!hasForm && !hasOAuth && (
        <div className="py-4 text-center">
          <p className="text-small text-danger">No authentication providers configured.</p>
          <p className="text-tiny text-default-500 mt-2">Please contact your administrator.</p>
        </div>
      )}
    </AuthCard>
  );
}
