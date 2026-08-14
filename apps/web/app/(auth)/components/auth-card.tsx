"use client";

import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AuthLanguageSelector } from "@/components/shared/auth-language-selector";
import { Separator } from "@heroui/react";

import { AuthFrame } from "./auth-frame";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <AuthFrame footer={footer}>
      {/* Language selector - top right */}
      <div className="absolute top-2 right-2">
        <AuthLanguageSelector />
      </div>

      {/* Header: on phones the wordmark above the card is hidden (AuthFrame),
          so the logo stands in for the heading; md+ keeps the text heading.
          The h1 stays in the tree for assistive tech either way. */}
      <div className="flex flex-col items-center gap-2 text-center">
        <BrandLogo
          priority
          className="mt-2 mb-1 w-full max-w-48 md:hidden"
          height={53}
          width={192}
        />
        <h1 className="sr-only font-serif text-3xl font-medium md:not-sr-only">{title}</h1>
        <p className="text-muted text-sm">{subtitle}</p>
      </div>

      <Separator className="my-2" />

      {children}
    </AuthFrame>
  );
}
