import { createContext } from "react";
import { appKeychain } from "@/lib/auth/app-keychain";
import { resetAuthClientStorage } from "@/lib/auth/auth-client";
import { AUTH_STORAGE_KEYS } from "@/lib/auth/auth-storage";
import { moveToSharedKeychain } from "@/lib/auth/shared-keychain";
import { clearServerTooOld } from "@/lib/network/too-old-server";

import { withoutTrailingSlashes } from "@norish/shared/lib/helpers";
import { httpUrlSchema } from "@norish/shared/lib/schema";

export const SERVER_ADDRESS_KEY = "norish.backend-base-url";
const listeners = new Set<() => void>();
// The last address read or saved, for callers that need it synchronously (tRPC, the probe).
let currentAddress = "";

/** The server the boot gate renders the app with; null in onboarding, which has no tRPC. */
export const ServerAddressContext = createContext<string | null>(null);

export function getServerAddress(): string {
  return currentAddress;
}

/**
 * Outcome of reading the stored Server Address. `error` stays apart from a `null` url,
 * since a failed secure-storage read is not an unset server and must not discard a saved one.
 */
export type ServerAddressState =
  | { status: "loading" }
  | { status: "ready"; url: string | null }
  | { status: "error"; error: unknown };

/** What a version check of a Server Address found. */
export type ServerAddressCheck =
  | { outcome: "ok"; address: string }
  /** `version` is what the server reported, when it reported one. */
  | { outcome: "too-old"; address: string; version?: string }
  | { outcome: "error"; reason: "invalid" | "unreachable" };

function emitServerAddressChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeServerAddressChange(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function normalizeServerAddress(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  if (!httpUrlSchema.safeParse(candidate).success) {
    return null;
  }

  try {
    const parsed = new URL(candidate);

    parsed.hash = "";
    parsed.search = "";

    return withoutTrailingSlashes(parsed.toString());
  } catch {
    return null;
  }
}

export async function loadServerAddress(): Promise<string | null> {
  // The boot's first SecureStore read, so the keychain the Share Extension reads is settled first.
  await moveToSharedKeychain([SERVER_ADDRESS_KEY, ...AUTH_STORAGE_KEYS]);

  const stored = await appKeychain.getItemAsync(SERVER_ADDRESS_KEY);

  const normalized = stored ? normalizeServerAddress(stored) : null;

  if (stored && !normalized) {
    await appKeychain.deleteItemAsync(SERVER_ADDRESS_KEY);
  }

  currentAddress = normalized ?? "";

  return normalized;
}

export async function saveServerAddress(input: string): Promise<string> {
  const normalized = normalizeServerAddress(input);

  if (!normalized) {
    throw new Error("Please enter a valid server address.");
  }

  // The same address again keeps the client, the cache and the screens reading them.
  if ((await loadServerAddress()) === normalized) return normalized;

  // The Offline Cache and Outbox are per signed-in owner, and sign-out already cleared the reads.
  await resetAuthClientStorage();
  await appKeychain.setItemAsync(SERVER_ADDRESS_KEY, normalized);
  currentAddress = normalized;
  clearServerTooOld();
  emitServerAddressChange();

  return normalized;
}

export function getServerHealthUrl(baseUrl: string): string {
  return `${baseUrl}/api/v1/health`;
}
