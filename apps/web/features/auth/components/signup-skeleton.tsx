"use client";

import { Description, Label, Skeleton } from "@heroui/react";
import { useTranslations } from "next-intl";

import { AuthCard } from "./auth-card";

/** The sign-up form with its real labels and grey fields. */
export default function SignupSkeleton() {
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
