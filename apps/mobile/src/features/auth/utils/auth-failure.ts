import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("auth");

/** How long a sign-in may stall before it fails; slow hardware hashes a password for seconds. */
export const SIGN_IN_DEADLINE_MS = 15_000;

type AuthError = { code?: string; message?: string };

// Better Auth codes `auth.errors` translates, lowercased as web's auth-error screen keys them.
const TRANSLATED_CODES = new Set([
  "provider_not_found",
  "social_account_already_linked",
  "account_not_found",
  "user_not_found",
  "internal_server_error",
  "unauthorized",
]);

function refusalMessageId(error: AuthError, fallback: string): string {
  if (error.code === "INVALID_EMAIL_OR_PASSWORD") return "auth.login.wrongCredentials";
  // Sign up's refusal; web shows the server's own text, which mobile never does.
  if (error.code?.startsWith("USER_ALREADY_EXISTS"))
    return "auth.errors.account_not_linked.description";

  // The server refuses a new Account when sign-ups are closed.
  if (error.code === "REGISTRATION_IS_CURRENTLY_DISABLED") return "auth.signup.errors.closed";

  if (error.code === "INVALID_EMAIL") return "common.validation.invalidEmail";

  const code = error.code?.toLowerCase();

  return code && TRANSLATED_CODES.has(code) ? `auth.errors.${code}.description` : fallback;
}

/**
 * The message id a Better Auth call fails with, or null on success; a network failure or timeout
 * says no server answered, any other throw is `fallback`, and raw text is only logged.
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

      // A sign-in's deadline aborts a stalled request, which RN's fetch rejects as an AbortError.
      const unreachable =
        thrown instanceof TypeError || (thrown instanceof Error && thrown.name === "AbortError");

      return unreachable ? "auth.connect.errors.unreachable" : fallback;
    }
  );
}
