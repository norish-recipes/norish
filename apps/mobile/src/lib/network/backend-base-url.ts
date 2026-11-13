import { createContext } from "react";
import { resetAuthClientStorage } from "@/lib/auth/auth-client";
import * as SecureStore from "expo-secure-store";

import { withoutTrailingSlashes } from "@norish/shared/lib/helpers";
import { httpUrlSchema } from "@norish/shared/lib/schema";

const BACKEND_BASE_URL_KEY = "norish.backend-base-url";
const listeners = new Set<() => void>();
// The last address read or saved, for callers that need it synchronously (tRPC, the probe).
let currentBaseUrl = "";

/** The server the boot gate renders the app with; null in onboarding, which has no tRPC. */
export const BackendBaseUrlContext = createContext<string | null>(null);

export function getBackendBaseUrl(): string {
  return currentBaseUrl;
}

/**
 * Outcome of reading the stored backend URL.
 *
 * `error` is deliberately distinct from `ready` with a `null` url: secure
 * storage failing is not the same as the user not having configured a server,
 * and collapsing the two would silently discard a configured backend.
 */
export type BackendBaseUrlState =
  | { status: "loading" }
  | { status: "ready"; url: string | null }
  | { status: "error"; error: unknown };

function emitBackendBaseUrlChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeBackendBaseUrlChange(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function normalizeBackendBaseUrl(input: string): string | null {
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

export async function loadBackendBaseUrl(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(BACKEND_BASE_URL_KEY);

  const normalized = stored ? normalizeBackendBaseUrl(stored) : null;

  if (stored && !normalized) {
    await SecureStore.deleteItemAsync(BACKEND_BASE_URL_KEY);
  }

  currentBaseUrl = normalized ?? "";

  return normalized;
}

export async function saveBackendBaseUrl(input: string): Promise<string> {
  const normalized = normalizeBackendBaseUrl(input);

  if (!normalized) {
    throw new Error("Please enter a valid backend URL.");
  }

  const existing = await loadBackendBaseUrl();

  // The Offline Cache and Outbox are per signed-in owner, and sign-out already cleared the reads.
  if (existing !== normalized) {
    await resetAuthClientStorage();
  }

  await SecureStore.setItemAsync(BACKEND_BASE_URL_KEY, normalized);
  currentBaseUrl = normalized;
  emitBackendBaseUrlChange();

  return normalized;
}

export function getBackendHealthUrl(baseUrl: string): string {
  return `${baseUrl}/api/v1/health`;
}
