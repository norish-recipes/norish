"use client";

import { ProviderIcon } from "@/components/auth/provider-icon";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import { signIn } from "@norish/shared/lib/auth/client";
import { addBasePath, APP_ROOT } from "@norish/shared/lib/base-path";

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
  callbackUrl = APP_ROOT,
}: ProviderButtonProps) {
  const t = useTranslations("auth.provider");
  const handleSignIn = async () => {
    await signIn.social({
      provider: providerId.toLowerCase(),
      callbackURL: callbackUrl,
      errorCallbackURL: addBasePath("/auth-error"),
    });
  };

  return (
    <Button fullWidth className="h-11 gap-3" variant="tertiary" onPress={handleSignIn}>
      <ProviderIcon icon={icon} providerName={providerName} width={20} />
      {t("signInWith", {
        provider: providerName,
      })}
    </Button>
  );
}
