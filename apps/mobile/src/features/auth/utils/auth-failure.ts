type AuthError = { code?: string; message?: string };

/**
 * The message a Better Auth call ends with, or null once it succeeds. A refusal comes back as
 * `error` and shows `refused` when it has no message; only a network failure throws.
 */
export function authFailure(
  call: Promise<{ error: AuthError | null }>,
  refused: string,
  failed: string = refused
): Promise<string | null> {
  return call
    .then(({ error }) => (error ? (error.message ?? refused) : null))
    .catch((thrown: unknown) => (thrown instanceof Error && thrown.message) || failed);
}

/** Better Auth's code for an unknown email or a wrong password; it doesn't say which. */
const WRONG_CREDENTIALS = "INVALID_EMAIL_OR_PASSWORD";

/** A password sign-in's failure: `wrong` for wrong credentials, else as `authFailure` maps it. */
export function signInFailure(
  call: Promise<{ error: AuthError | null }>,
  wrong: string,
  refused: string
): Promise<string | null> {
  return authFailure(
    call.then(({ error }) => ({
      error: error?.code === WRONG_CREDENTIALS ? { message: wrong } : error,
    })),
    refused
  );
}
