"use client";

import { useTranslations } from "next-intl";

import { APP_ROOT } from "@norish/shared/lib/base-path";

import { AuthCard } from "./components/auth-card";
import { SignupForm } from "./components/signup-form";

interface SignupScreenProps {
  callbackUrl?: string;
}

export function SignupScreen({ callbackUrl = APP_ROOT }: SignupScreenProps) {
  const t = useTranslations("auth.signup");

  return (
    <AuthCard subtitle={t("subtitle")} title={t("heading")}>
      <SignupForm callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
