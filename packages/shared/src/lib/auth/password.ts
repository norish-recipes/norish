/** Better Auth's password bounds, which the sign-up forms check before the server does. */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/** What is wrong with a new password, and whether the change form can go. */
export function passwordChecks({
  current,
  next,
  confirmation,
}: {
  current: string;
  next: string;
  confirmation: string;
}) {
  const tooShort = next.length > 0 && next.length < MIN_PASSWORD_LENGTH;
  const tooLong = next.length > MAX_PASSWORD_LENGTH;
  const mismatch = confirmation.length > 0 && confirmation !== next;
  const valid = current !== "" && next !== "" && !tooShort && !tooLong && confirmation === next;

  return { tooShort, tooLong, mismatch, valid };
}
