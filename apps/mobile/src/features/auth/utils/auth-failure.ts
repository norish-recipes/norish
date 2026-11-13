/**
 * The message a Better Auth call ends with, or null once it succeeds. A refusal comes back as
 * `error` and shows `refused` when it has no message; only a network failure throws.
 */
export function authFailure(
  call: Promise<{ error: { message?: string } | null }>,
  refused: string,
  failed: string = refused
): Promise<string | null> {
  return call
    .then(({ error }) => (error ? (error.message ?? refused) : null))
    .catch((thrown: unknown) => (thrown instanceof Error && thrown.message) || failed);
}
