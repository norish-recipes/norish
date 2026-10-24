"use client";

import { AuthCard } from "@/app/(auth)/components/auth-card";
import { Description, Label, Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * Sign-in before the server says how: the real frame and heading over grey rows, since
 * the form and the provider buttons depend on the instance.
 */
export default function LoginSkeleton() {
  const t = useTranslations("auth.login");

  return (
    <AuthCard subtitle={t("subtitle")} title={t("heading")}>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-xl" />
        ))}
      </div>
    </AuthCard>
  );
}

/** The sign-up form with its real labels and grey fields. */
export function SignupSkeleton() {
  const t = useTranslations("auth.signup");

  return (
    <AuthCard subtitle={t("subtitle")} title={t("heading")}>
      <div className="flex flex-col gap-4">
        {(["name", "email", "password", "confirmPassword"] as const).map((field) => (
          <div key={field} className="flex flex-col gap-1">
            <Label>{t(field)}</Label>
            <Skeleton className="h-10 w-full rounded-xl" />
            {field === "password" && <Description>{t("passwordDescription")}</Description>}
          </div>
        ))}
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </AuthCard>
  );
}
