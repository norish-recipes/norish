"use client";

import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import { signIn } from "@norish/shared/lib/auth/client";

import { ProviderIcon } from "./provider-icon";

interface ProviderButtonProps {
  providerId: string;
  providerName: string;
  icon: string;
  callbackUrl?: string;
}
export function ProviderButton({
  providerId,
  providerName,
  icon,
  callbackUrl = "/",
}: ProviderButtonProps) {
  const t = useTranslations("auth.provider");
  const handleSignIn = async () => {
    const id = providerId.toLowerCase();

    // GitHub and Google use signIn.social(), OIDC uses signIn.oauth2()
    if (id === "github" || id === "google") {
      await signIn.social({
        provider: id,
        callbackURL: callbackUrl,
        errorCallbackURL: "/auth-error",
      });
    } else {
      // Generic OAuth (OIDC) via genericOAuth plugin
      await signIn.oauth2({
        providerId,
        callbackURL: callbackUrl,
        errorCallbackURL: "/auth-error",
      });
    }
  };
  return (
    <Button fullWidth className="h-11 gap-3" onPress={handleSignIn} variant="tertiary">
      {<ProviderIcon icon={icon} providerName={providerName} width={20} />}
      {t("signInWith", {
        provider: providerName,
      })}
    </Button>
  );
}
