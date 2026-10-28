"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/16/solid";
import { buttonVariants, Skeleton } from "@heroui/react";
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
  "account_not_linked",
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
function BackToLogin() {
  const t = useTranslations("auth.errors");

  return (
    <Link
      className={buttonVariants({ fullWidth: true, variant: "primary", className: "h-11" })}
      href="/login?logout=true"
    >
      <ArrowLeftIcon className="size-4" />
      {t("backToLogin")}
    </Link>
  );
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

      <BackToLogin />
    </AuthFrame>
  );
}

/** The page before its search params are read: the frame, a grey alert and the real way back. */
function AuthErrorSkeleton() {
  return (
    <AuthFrame contentClassName="items-center">
      <Skeleton className="h-20 w-full rounded-xl" />
      <BackToLogin />
    </AuthFrame>
  );
}

// The page is prerendered, and the error only arrives with the search params.
export default function AuthErrorPage() {
  return (
    <Suspense fallback={<AuthErrorSkeleton />}>
      <AuthErrorContent />
    </Suspense>
  );
}
