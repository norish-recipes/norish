import { clearQueryCachesOnUrlChange } from "@/hooks/use-cache-lifecycle";
import { resetAuthClientStorage } from "@/lib/auth-client";
import * as SecureStore from "expo-secure-store";

import { httpUrlSchema } from "@norish/shared/lib/schema";

const BACKEND_BASE_URL_KEY = "norish.backend-base-url";
const listeners = new Set<() => void>();

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

    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export async function loadBackendBaseUrl(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync(BACKEND_BASE_URL_KEY);

  if (!stored) {
    return null;
  }

  const normalized = normalizeBackendBaseUrl(stored);

  if (!normalized) {
    await SecureStore.deleteItemAsync(BACKEND_BASE_URL_KEY);
    return null;
  }

  return normalized;
}

export async function saveBackendBaseUrl(input: string): Promise<string> {
  const normalized = normalizeBackendBaseUrl(input);

  if (!normalized) {
    throw new Error("Please enter a valid backend URL.");
  }

  const existing = await loadBackendBaseUrl();

  if (existing !== normalized) {
    clearQueryCachesOnUrlChange();
    await resetAuthClientStorage();
  }

  await SecureStore.setItemAsync(BACKEND_BASE_URL_KEY, normalized);
  emitBackendBaseUrlChange();

  return normalized;
}

export async function clearBackendBaseUrl(): Promise<void> {
  await resetAuthClientStorage();
  await SecureStore.deleteItemAsync(BACKEND_BASE_URL_KEY);
  emitBackendBaseUrlChange();
}

export function getBackendHealthUrl(baseUrl: string): string {
  return `${baseUrl}/api/v1/health`;
}

export function getBackendTrpcUrl(baseUrl: string): string {
  return `${baseUrl}/api/trpc`;
}
