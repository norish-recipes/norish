import type { ServerAddressCheck, ServerAddressState } from "@/lib/network/server-address";

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

/**
 * At launch: a too old server goes to Update your server once the launch has played out, unless
 * the saved address changed since; anything else carries on.
 */
export function resolveLaunchVersionCheck(
  check: ServerAddressCheck,
  saved: string,
  launchFinished: boolean
):
  | { screen: "update-server"; address: string; version?: string }
  | { screen: "wait" }
  | { screen: "continue" } {
  if (check.outcome !== "too-old" || check.address !== saved) return { screen: "continue" };

  return launchFinished
    ? { screen: "update-server", address: check.address, version: check.version }
    : { screen: "wait" };
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

/** Update your server checks the address it was opened for, else the saved one; with neither, the signed-out entry. */
export function resolveUpdateServerAddress(
  param: string | undefined,
  saved: string
): { screen: "update-server"; address: string } | { screen: "signed-out-entry" } {
  const address = param || saved;

  return address ? { screen: "update-server", address } : { screen: "signed-out-entry" };
}
