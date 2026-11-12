import type { ServerAddressState } from "@/lib/network/server-address";

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
