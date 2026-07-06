"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExclamationTriangleIcon, ShieldExclamationIcon } from "@heroicons/react/16/solid";
import { Button, Card } from "@heroui/react";
import { useTranslations } from "next-intl";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("AuthError");

// List of known error codes for type-safe translation lookups
const ERROR_CODES = [
  "state_mismatch",
  "invalid_state",
  "access_denied",
  "oauth_code_verification_failed",
  "unable_to_get_user_info",
  "provider_not_found",
  "social_account_already_linked",
  "account_not_found",
  "registration_is_currently_disabled",
  "user_not_found",
  "internal_server_error",
  "unauthorized",
] as const;
type ErrorCode = (typeof ERROR_CODES)[number];
function isKnownErrorCode(code: string): code is ErrorCode {
  return ERROR_CODES.includes(code as ErrorCode);
}
function AuthErrorContent() {
  const t = useTranslations("auth.errors");
  const searchParams = useSearchParams();
  const error = searchParams.get("error")?.toLowerCase();
  log.debug(
    {
      error,
    },
    "Auth error"
  );

  // Get error info from translations
  const errorKey = error && isKnownErrorCode(error) ? error : "default";
  const title = t(`${errorKey}.title`);
  const description = t(`${errorKey}.description`);
  log.debug(
    {
      title,
      description,
    },
    "Auth error info"
  );
  const isServerError = error === "internal_server_error";
  return (
    <div className="bg-background flex min-h-full items-center justify-center p-6">
      <Card className="border-border bg-surface/70 w-full max-w-md rounded-3xl border p-8 text-center shadow-sm backdrop-blur-md">
        <Card.Content className="flex flex-col items-center space-y-6">
          <div
            className={`rounded-full p-4 ${isServerError ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"}`}
          >
            {isServerError ? (
              <ExclamationTriangleIcon className="h-9 w-9" />
            ) : (
              <ShieldExclamationIcon className="h-9 w-9" />
            )}
          </div>

          <div className="flex flex-col items-center space-y-2">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted text-center text-sm leading-relaxed">{description}</p>
            {error && error !== "registration_disabled" && (
              <p className="text-muted mt-2 text-xs">
                {t("errorCode", {
                  code: error,
                })}
              </p>
            )}
          </div>

          <Link href="/login?logout=true">
            <Button className="mt-2 rounded-lg px-6" variant="primary">
              {t("backToLogin")}
            </Button>
          </Link>
        </Card.Content>
      </Card>
    </div>
  );
}
export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center">
          <div className="border-accent h-8 w-8 animate-spin rounded-full border-b-2" />
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
