// Dev-only forced Offline (ADR-0007): a localStorage flag over the connectivity
// machine, stripped from production builds by the NODE_ENV constant below.

const OFFLINE_FORCED_STORAGE_KEY = "norish.dev.offline-forced";

/** Same-tab change notification (the `storage` event only fires cross-tab). */
const OFFLINE_FORCED_EVENT = "norish:offline-forced-change";

/** Whether forced Offline exists in this build; `false` in production. */
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

/** Set or clear the forced-Offline flag every consumer reads. A no-op in production. */
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

// The Offline Toggle: entering reloads so the probe, dev link and socket re-derive from the flag;
// exiting resumes the probe loop and Recovery converges (ADR-0007).
export function switchOfflineForced(next: boolean): void {
  setOfflineForced(next);

  if (next) {
    window.location.reload();
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
