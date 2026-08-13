"use client";

import type { ReactNode } from "react";
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

      {/* Header */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-serif text-3xl font-medium">{title}</h1>
        <p className="text-muted text-sm">{subtitle}</p>
      </div>

      <Separator className="my-2" />

      {children}
    </AuthFrame>
  );
}
