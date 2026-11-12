import { z } from "zod";

/** Better Auth's sign-up route validates the body with z.email(); this is the same check. */
export function isValidEmail(email: string): boolean {
  return z.email().safeParse(email).success;
}
