import type { LaunchPhase } from "@/lib/boot/launch-motion";
import type { ServerAddressCheck } from "@/lib/network/server-address";
import type { TooOldServer } from "@/lib/network/too-old-server";

/** At launch: a too old answer for the still-saved address holds Update your server; anything else carries on. */
export function resolveLaunchVersionCheck(
  check: ServerAddressCheck,
  saved: string
): { screen: "update-server"; address: string; version?: string } | { screen: "continue" } {
  if (check.outcome !== "too-old" || check.address !== saved) return { screen: "continue" };

  return { screen: "update-server", address: check.address, version: check.version };
}

/**
 * While a Server Address is held too old, the mounted navigator shows Update your server:
 * unanimated while the splash still covers the screen, after the splash once it is leaving.
 */
export function resolveTooOldServerRoute(
  tooOld: TooOldServer | null,
  onUpdateServer: boolean,
  phase: LaunchPhase
):
  | { screen: "update-server"; address: string; version?: string; animated: boolean }
  | { screen: "stay" } {
  if (!tooOld || onUpdateServer || phase === "leaving") return { screen: "stay" };

  return { screen: "update-server", ...tooOld, animated: phase === "done" };
}

/** Where a new enough server continues to: Sign in signed out (saving the address), else the signed-in app. */
export type ForegroundContinue =
  { screen: "sign-in"; address: string } | { screen: "signed-in-app" };

/** On a foreground return while Update your server shows: only a new enough server moves on. */
export function resolveForegroundVersionCheck(
  check: ServerAddressCheck,
  signedIn: boolean
): ForegroundContinue | { screen: "stay" } {
  if (check.outcome !== "ok") return { screen: "stay" };

  return signedIn ? { screen: "signed-in-app" } : { screen: "sign-in", address: check.address };
}

/**
 * Update your server shows only for an address a check found too old: the one it was opened
 * for, else the saved one. Unknown (a deep link), it is checked first; anything else leaves.
 */
export function resolveUpdateServerRoute(
  param: string | undefined,
  saved: string,
  tooOld: TooOldServer | null,
  check: ServerAddressCheck | null
):
  | { screen: "update-server"; address: string; version?: string }
  | { screen: "check"; address: string }
  | { screen: "leave" } {
  const address = param || saved;

  if (!address) return { screen: "leave" };

  const answer =
    check ?? (tooOld?.address === address ? { outcome: "too-old" as const, ...tooOld } : null);

  if (!answer) return { screen: "check", address };

  return answer.outcome === "too-old"
    ? { screen: "update-server", address: answer.address, version: answer.version }
    : { screen: "leave" };
}

/**
 * After a new enough server is saved over Update your server: dismiss it when there is a screen
 * beneath, and go on to Sign in unless that screen already was Sign in for this saved address.
 */
export function resolveSavedServerContinue(wasSaved: boolean, canDismiss: boolean) {
  return { dismiss: canDismiss, signIn: !wasSaved || !canDismiss };
}
