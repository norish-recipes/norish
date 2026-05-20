"use client";

import { useTranslations } from "next-intl";

import { AuthCard } from "../../components/auth-card";

import { SignupForm } from "./signup-form";

interface SignupClientProps {
  callbackUrl?: string;
}

export function SignupClient({ callbackUrl = "/" }: SignupClientProps) {
  const t = useTranslations("auth.signup");

  return (
    <AuthCard subtitle={t("subtitle")} title={t("title")}>
      <SignupForm callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
