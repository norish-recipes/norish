import { SIGN_IN_DEADLINE_MS } from "@/features/auth/utils/auth-failure";

/** Signing in waits for a session up to the sign-in deadline; an outside link with none pending fails. */
export function resolveSigningIn(
  signedIn: boolean,
  waitedMs: number
): "wait" | "signed-in" | "failed" {
  if (signedIn) return "signed-in";

  return waitedMs >= SIGN_IN_DEADLINE_MS ? "failed" : "wait";
}
