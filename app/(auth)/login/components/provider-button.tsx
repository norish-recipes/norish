"use client";

import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import { ProviderIcon } from "./provider-icon";

import { signIn } from "@/lib/auth/client";

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
    <Button
      className="border-default-200 bg-default-100 hover:bg-default-100 active:bg-default-200 flex h-11 w-full items-center justify-center gap-3 rounded-xl border shadow-sm transition-colors"
      startContent={<ProviderIcon icon={icon} providerName={providerName} width={20} />}
      variant="flat"
      onPress={handleSignIn}
    >
      {t("signInWith", { provider: providerName })}
    </Button>
  );
}
