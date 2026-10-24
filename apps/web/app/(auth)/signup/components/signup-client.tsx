"use client";

import { useTranslations } from "next-intl";

import { APP_ROOT } from "@norish/shared/lib/base-path";

import { AuthCard } from "../../components/auth-card";
import { SignupForm } from "./signup-form";

interface SignupClientProps {
  callbackUrl?: string;
}

export function SignupClient({ callbackUrl = APP_ROOT }: SignupClientProps) {
  const t = useTranslations("auth.signup");

  return (
    <AuthCard subtitle={t("subtitle")} title={t("heading")}>
      <SignupForm callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
