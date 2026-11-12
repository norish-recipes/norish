import type { ServerAddressCheck, ServerAddressState } from "@/lib/network/server-address";
import type { TooOldServer } from "@/lib/network/too-old-server";

/**
 * What the app shell should render once (or while) its async prerequisites
 * settle.
 *
 * Keeping every branch named here is deliberate: the boot gate previously
 * folded "still loading" and "failed to load" into a single `undefined`, so a
 * failure was indistinguishable from a slow read and left the app on a blank
 * screen forever.
 */
type BootPhase =
  /** Hydration still in flight. The native splash stays up. */
  | { phase: "loading" }
  /** Secure storage is unreadable, so the Server Address is unknown. */
  | { phase: "storage-error"; error: unknown }
  /** Storage read fine and no Server Address is saved yet. */
  | { phase: "onboarding" }
  /** Storage read fine and a Server Address is saved. */
  | { phase: "ready"; serverAddress: string };

type BootInputs = {
  /** Whether the persisted appearance preference has settled. */
  appearanceHydrated: boolean;
  /** Whether the app fonts have loaded (or failed and fell back to the system font). */
  fontsReady: boolean;
  serverAddress: ServerAddressState;
};

/**
 * Decides which shell to render from the independent hydration inputs.
 */
export function resolveBootPhase({
  appearanceHydrated,
  fontsReady,
  serverAddress,
}: BootInputs): BootPhase {
  if (!appearanceHydrated || !fontsReady || serverAddress.status === "loading") {
    return { phase: "loading" };
  }

  if (serverAddress.status === "error") {
    return { phase: "storage-error", error: serverAddress.error };
  }

  if (!serverAddress.url) {
    return { phase: "onboarding" };
  }

  return { phase: "ready", serverAddress: serverAddress.url };
}

/** After the splash: glide into Server address, or fade to the screen underneath. */
export type LaunchHandoff = "glide" | "fade";

/**
 * How the splash leaves once its hold ends; `null` holds it until the boot phase decides.
 * A glide needs Server address's measured brand, so without one the splash fades.
 */
export function resolveLaunchMotion(
  handoff: LaunchHandoff | null,
  reduceMotion: boolean,
  target: number | null
): LaunchHandoff | null {
  if (handoff === null) return null;

  return handoff === "glide" && !reduceMotion && target !== null ? "glide" : "fade";
}

/** The signed-out stack's first screen. */
export type SignedOutEntry = "server-address" | "sign-in";

/**
 * Sign in once a Server Address is saved, decided before the first frame so nothing slides
 * over it; Server address when none is saved or the reader asked to change it.
 */
export function resolveSignedOutEntry(
  serverAddress: string,
  changeRequested: boolean
): SignedOutEntry {
  return serverAddress && !changeRequested ? "sign-in" : "server-address";
}

/**
 * The screen a Sign-out or Session Expiry lands on (Sign in, or Server address after the chip's
 * Sign-out) fades in once, for the Server Address the session left.
 */
export function fadesInAfterSessionEnd(leftFrom: string | null, serverAddress: string): boolean {
  return leftFrom !== null && leftFrom === serverAddress;
}

/** The most one frame moves the launch clock: two 60 Hz frames. */
const MAX_LAUNCH_STEP = 1000 / 30;

/**
 * The launch clock after a frame: forward by the frame's time, capped so a frame stalled on
 * the first mount can't skip the slogan's fade, and never past `stop`.
 */
export function stepLaunchClock(clock: number, elapsed: number | null, stop: number) {
  "worklet";

  if (clock >= stop) return clock;

  return Math.min(clock + Math.min(elapsed ?? 0, MAX_LAUNCH_STEP), stop);
}

/** Where the launch is: the splash still opaque, fading or gliding away, or gone. */
export type LaunchPhase = "covered" | "leaving" | "done";

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
): { screen: "update-server"; address: string; version?: string; animated: boolean } | { screen: "stay" } {
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

/** Changing the Server Address: signed out, Server address opens; signed in, Sign-out comes first. */
export function resolveServerChange(signedIn: boolean): "server-address" | "sign-out-first" {
  return signedIn ? "sign-out-first" : "server-address";
}
