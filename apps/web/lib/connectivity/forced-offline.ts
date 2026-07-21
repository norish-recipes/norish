/**
 * The dev-only forced-Offline override (ADR-0007).
 *
 * Forcing Offline is a development affordance, not a shipped user control: it
 * lets a developer exercise the Outbox, cache-serving and Reconnect Sequence
 * without taking the backend down. It is modelled as an orthogonal persisted
 * override — a `localStorage` flag — layered on top of the pure two-state
 * connectivity machine, *not* a third machine state. The effective posture
 * (`live | offline | offline-forced`) is derived from this flag by the
 * connectivity provider; in production the flag is always absent, so the posture
 * collapses back to the machine state.
 *
 * {@link OFFLINE_FORCED_AVAILABLE} gates every path on `NODE_ENV`, the same
 * build-time strip `apps/web/lib/logger.ts` uses, so no forced-Offline code or
 * UI ships to users: the constant folds to `false` in a production build and
 * dead-code elimination removes the flag read, the toggle row and the dev link.
 */

const OFFLINE_FORCED_STORAGE_KEY = "norish.dev.offline-forced";

/** Same-tab change notification (the `storage` event only fires cross-tab). */
const OFFLINE_FORCED_EVENT = "norish:offline-forced-change";

/**
 * Whether the forced-Offline affordance exists in this build. Folds to a
 * constant `false` in production so the whole feature is stripped (ADR-0007).
 */
export const OFFLINE_FORCED_AVAILABLE = process.env.NODE_ENV !== "production";

/** Whether Offline is currently being forced. Always `false` in production. */
export function isOfflineForced(): boolean {
  if (!OFFLINE_FORCED_AVAILABLE || typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(OFFLINE_FORCED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Set or clear the forced-Offline flag. A no-op in production. The persisted
 * flag is the single source of truth every consumer reads (the provider, the
 * dev tRPC link); callers that want the transport to re-derive cleanly reload
 * afterwards.
 */
export function setOfflineForced(next: boolean): void {
  if (!OFFLINE_FORCED_AVAILABLE || typeof window === "undefined") {
    return;
  }

  try {
    if (next) {
      window.localStorage.setItem(OFFLINE_FORCED_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(OFFLINE_FORCED_STORAGE_KEY);
    }

    window.dispatchEvent(new CustomEvent(OFFLINE_FORCED_EVENT));
  } catch {
    // localStorage disabled (private mode, etc.). This is a dev affordance, so a
    // silent failure is acceptable — nothing user-facing depends on it.
  }
}

/** Subscribe to forced-Offline changes (same-tab and cross-tab). */
export function subscribeOfflineForced(listener: () => void): () => void {
  if (!OFFLINE_FORCED_AVAILABLE || typeof window === "undefined") {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    // A `null` key means the whole store was cleared — re-read to be safe.
    if (event.key === OFFLINE_FORCED_STORAGE_KEY || event.key === null) {
      listener();
    }
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(OFFLINE_FORCED_EVENT, listener);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(OFFLINE_FORCED_EVENT, listener);
  };
}
