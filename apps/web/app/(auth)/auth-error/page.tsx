"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExclamationTriangleIcon, ShieldExclamationIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import { createClientLogger } from "@norish/shared/lib/logger";

import { AuthAlert } from "../components/auth-alert";
import { AuthFrame } from "../components/auth-frame";

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
    <AuthFrame contentClassName="items-center">
      {/* The visible title lives in the alert; keep a document heading for the outline. */}
      <h1 className="sr-only">{title}</h1>

      <AuthAlert
        description={description}
        icon={
          isServerError ? (
            <ExclamationTriangleIcon className="size-5" />
          ) : (
            <ShieldExclamationIcon className="size-5" />
          )
        }
        status={isServerError ? "warning" : "danger"}
        title={title}
      />

      {error && error !== "registration_is_currently_disabled" && (
        <p className="text-muted text-xs">
          {t("errorCode", {
            code: error,
          })}
        </p>
      )}

      <Link href="/login?logout=true">
        <Button className="rounded-lg px-6" variant="primary">
          {t("backToLogin")}
        </Button>
      </Link>
    </AuthFrame>
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
