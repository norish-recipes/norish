"use client";

import { Button, Card, CardBody } from "@heroui/react";
import { ShieldExclamationIcon, ExclamationTriangleIcon } from "@heroicons/react/16/solid";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("AuthError");

// Error messages mapped from BetterAuth error codes
const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  // OAuth flow errors
  state_mismatch: {
    title: "Session Expired",
    description: "Your sign-in session expired or the request was invalid. Please try again.",
  },
  invalid_state: {
    title: "Invalid Request",
    description: "The sign-in request was invalid. Please try again.",
  },
  access_denied: {
    title: "Access Denied",
    description: "You denied access to your account. Please try again if this was a mistake.",
  },
  oauth_code_verification_failed: {
    title: "Verification Failed",
    description: "Failed to verify your sign-in. Please try again.",
  },
  unable_to_get_user_info: {
    title: "Provider Error",
    description: "Could not get your account information from the provider. Please try again.",
  },
  provider_not_found: {
    title: "Provider Not Found",
    description: "The authentication provider is not configured.",
  },
  // Account linking errors
  social_account_already_linked: {
    title: "Account Already Linked",
    description: "This social account is already linked to another user.",
  },
  account_not_found: {
    title: "Account Not Found",
    description: "No account found.",
  },
  registration_is_currently_disabled: {
    title: "Registration Disabled",
    description: "New registrations are currently disabled.",
  },
  user_not_found: {
    title: "User Not Found",
    description: "Your account was not found. Registration may be disabled.",
  },
  // Generic errors
  internal_server_error: {
    title: "Server Error",
    description: "Something went wrong on our end. Please try again later.",
  },
  unauthorized: {
    title: "Unauthorized",
    description: "You are not authorized to access this resource.",
  },
  // Default for unknown errors
  default: {
    title: "Authentication Error",
    description: "An error occurred during sign-in. Please try again.",
  },
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error")?.toLowerCase();

  log.debug({ error }, "Auth error");
  // Get error info or use default for registration disabled
  const errorInfo = error
    ? ERROR_MESSAGES[error] || ERROR_MESSAGES.default
    : ERROR_MESSAGES.default;

  log.debug({ errorInfo }, "Auth error info");
  const isServerError = error === "internal_server_error";

  return (
    <div className="bg-background flex min-h-full items-center justify-center p-6">
      <Card
        className="border-default-200 bg-content1/70 w-full max-w-md rounded-3xl border p-8 text-center backdrop-blur-md"
        shadow="sm"
      >
        <CardBody className="flex flex-col items-center space-y-6">
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
            <h1 className="text-2xl font-bold">{errorInfo.title}</h1>
            <p className="text-default-500 text-center text-small leading-relaxed">
              {errorInfo.description}
            </p>
            {error && error !== "registration_disabled" && (
              <p className="text-default-400 mt-2 text-xs">Error code: {error}</p>
            )}
          </div>

          <Link href="/login?logout=true">
            <Button className="mt-2 px-6" color="primary" radius="lg" variant="solid">
              Back to Login
            </Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center">
          <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-b-2" />
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
