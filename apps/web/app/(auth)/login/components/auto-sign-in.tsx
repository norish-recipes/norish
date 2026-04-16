"use client";

import { useEffect, useRef } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Card, CardBody, Spinner } from "@heroui/react";

import type { ProviderInfo } from "@norish/shared/contracts";
import { signIn } from "@norish/shared/lib/auth/client";

import { ProviderIcon } from "./provider-icon";

interface AutoSignInProps {
  provider: ProviderInfo;
  callbackUrl: string;
}

export function AutoSignIn({ provider, callbackUrl }: AutoSignInProps) {
  const redirectInitiated = useRef(false);

  useEffect(() => {
    if (redirectInitiated.current) return;
    redirectInitiated.current = true;

    const providerId = provider.id.toLowerCase();

    // GitHub and Google use signIn.social(), OIDC uses signIn.oauth2()
    if (providerId === "github" || providerId === "google") {
      signIn.social({
        provider: providerId,
        callbackURL: callbackUrl,
        errorCallbackURL: "/auth-error",
      });
    } else {
      // Generic OAuth (OIDC) via genericOAuth plugin
      signIn.oauth2({
        providerId: provider.id,
        callbackURL: callbackUrl,
        errorCallbackURL: "/auth-error",
      });
    }
  }, [provider, callbackUrl]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <Card className="w-full max-w-sm overflow-hidden">
        <CardBody className="flex flex-col items-center gap-6 p-8">
          {/* Logo */}
          <BrandLogo priority height={40} width={140} />

          {/* Provider indicator */}
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative">
              <div className="bg-primary/10 absolute inset-0 animate-ping rounded-full" />
              <div className="bg-default-100 border-default-200 relative flex h-16 w-16 items-center justify-center rounded-full border">
                <ProviderIcon icon={provider.icon} providerName={provider.name} width={32} />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-2">
                <span className="text-default-600 font-medium">Redirecting to {provider.name}</span>
              </div>
              <p className="text-tiny text-default-400">You&apos;ll be signed in automatically</p>
              <Spinner color="primary" size="sm" />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
