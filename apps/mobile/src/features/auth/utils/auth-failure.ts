import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("auth");

type AuthError = { code?: string; message?: string };

// Better Auth codes `auth.errors` translates, lowercased as web's auth-error screen keys them.
const TRANSLATED_CODES = new Set([
  "provider_not_found",
  "social_account_already_linked",
  "account_not_found",
  "registration_is_currently_disabled",
  "user_not_found",
  "internal_server_error",
  "unauthorized",
]);

function refusalMessageId(error: AuthError, fallback: string): string {
  if (error.code === "INVALID_EMAIL_OR_PASSWORD") return "auth.login.wrongCredentials";

  const code = error.code?.toLowerCase();

  return code && TRANSLATED_CODES.has(code) ? `auth.errors.${code}.description` : fallback;
}

/**
 * The message id a Better Auth call fails with, or null once it succeeds. A refusal comes back
 * as `error`; a throw is a network failure (a `TypeError`) or else `fallback`. Raw text is only logged.
 */
export function authFailure(
  call: Promise<{ error: AuthError | null }>,
  fallback: string
): Promise<string | null> {
  return call.then(
    ({ error }) => {
      if (!error) return null;

      log.warn({ code: error.code, message: error.message }, "Auth call refused");

      return refusalMessageId(error, fallback);
    },
    (thrown: unknown) => {
      log.warn({ error: thrown }, "Auth call failed");

      return thrown instanceof TypeError ? "auth.connect.errors.unreachable" : fallback;
    }
  );
}
