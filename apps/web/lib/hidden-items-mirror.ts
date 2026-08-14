/**
 * The last hidden list this device saw, kept for first paint only.
 *
 * Hidden Items are stored server-side so they follow the reader between
 * devices; this mirror exists because two load paths cannot ask the server
 * before painting: a navigation answered by the service worker's cached HTML
 * and the offline bootstrap. Both read the mirror synchronously, then the
 * live preferences take over and rewrite it. The server stays authoritative —
 * the mirror is never written back to it.
 *
 * The entry is keyed to the same boot owner the persisted query cache trusts
 * (ADR-0005), so an account switch can never paint the previous reader's
 * choices for one frame.
 */
import { CACHE_OWNER_STORAGE_KEY } from "@/lib/query-cache/cache-identity";

export const HIDDEN_ITEMS_MIRROR_KEY = "norish.offline.hidden-items";

export function readHiddenItemsMirror(): string[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const owner = window.localStorage.getItem(CACHE_OWNER_STORAGE_KEY);
    const raw = window.localStorage.getItem(HIDDEN_ITEMS_MIRROR_KEY);

    if (!owner || !raw) {
      return null;
    }

    const entry = JSON.parse(raw) as { owner?: unknown; hidden?: unknown };

    if (entry.owner !== owner || !Array.isArray(entry.hidden)) {
      return null;
    }

    return entry.hidden.filter((item): item is string => typeof item === "string");
  } catch {
    return null;
  }
}

export function writeHiddenItemsMirror(owner: string, hidden: readonly string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(HIDDEN_ITEMS_MIRROR_KEY, JSON.stringify({ owner, hidden }));
  } catch {
    // Private-mode or quota failure: the mirror degrades to absent, which
    // renders everything — the documented meaning of an absent list.
  }
}

export function clearHiddenItemsMirror(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(HIDDEN_ITEMS_MIRROR_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
