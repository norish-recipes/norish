"use client";

import { useEffect, useRef } from "react";
import { ProviderIcon } from "@/components/auth/provider-icon";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Card, Spinner } from "@heroui/react";

import type { ProviderInfo } from "@norish/shared/contracts";
import { signIn } from "@norish/shared/lib/auth/client";
import { addBasePath } from "@norish/shared/lib/base-path";

interface AutoSignInProps {
  provider: ProviderInfo;
  callbackUrl: string;
  /** False until the ended session's offline data is forgotten; the provider page leaves this one. */
  ready: boolean;
}

export function AutoSignIn({ provider, callbackUrl, ready }: AutoSignInProps) {
  const redirectInitiatedRef = useRef(false);

  useEffect(() => {
    if (!ready || redirectInitiatedRef.current) return;
    redirectInitiatedRef.current = true;

    signIn.social({
      provider: provider.id.toLowerCase(),
      callbackURL: callbackUrl,
      errorCallbackURL: addBasePath("/auth-error"),
    });
  }, [provider, callbackUrl, ready]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center">
      <Card className="w-full max-w-sm overflow-hidden">
        <Card.Content className="flex flex-col items-center gap-6 p-8">
          <BrandLogo priority height={40} width={140} />

          <div className="flex flex-col items-center gap-4 py-4">
            <div className="relative">
              <div className="bg-accent/10 absolute inset-0 animate-ping rounded-full" />
              <div className="bg-surface-secondary border-border relative flex h-16 w-16 items-center justify-center rounded-full border">
                <ProviderIcon icon={provider.icon} providerName={provider.name} width={32} />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-2">
                <span className="text-muted font-medium">Redirecting to {provider.name}</span>
              </div>
              <p className="text-muted text-xs">You&apos;ll be signed in automatically</p>
              <Spinner color="accent" size="sm" />
            </div>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
