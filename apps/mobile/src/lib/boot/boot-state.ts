import type { BackendBaseUrlState } from "@/lib/network/backend-base-url";

/**
 * What the app shell should render once (or while) its async prerequisites
 * settle.
 *
 * Keeping every branch named here is deliberate: the boot gate previously
 * folded "still loading" and "failed to load" into a single `undefined`, so a
 * failure was indistinguishable from a slow read and left the app on a blank
 * screen forever.
 */
export type BootPhase =
  /** Hydration still in flight. The native splash stays up. */
  | { phase: "loading" }
  /** Secure storage is unreadable, so the configured backend is unknown. */
  | { phase: "storage-error"; error: unknown }
  /** Storage read fine and no backend is configured yet. */
  | { phase: "onboarding" }
  /** Storage read fine and a backend is configured. */
  | { phase: "ready"; backendBaseUrl: string };

export type BootInputs = {
  /** Whether the persisted appearance preference has settled. */
  appearanceHydrated: boolean;
  /** Whether the persisted query cache has settled (restored or given up). */
  cacheReady: boolean;
  backendBaseUrl: BackendBaseUrlState;
};

/**
 * Decides which shell to render from the three independent hydration inputs.
 */
export function resolveBootPhase({
  appearanceHydrated,
  cacheReady,
  backendBaseUrl,
}: BootInputs): BootPhase {
  if (!appearanceHydrated || !cacheReady || backendBaseUrl.status === "loading") {
    return { phase: "loading" };
  }

  if (backendBaseUrl.status === "error") {
    return { phase: "storage-error", error: backendBaseUrl.error };
  }

  if (!backendBaseUrl.url) {
    return { phase: "onboarding" };
  }

  return { phase: "ready", backendBaseUrl: backendBaseUrl.url };
}
