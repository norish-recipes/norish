import * as SecureStore from 'expo-secure-store';

import { httpUrlSchema } from '@norish/shared/lib/schema';

const BACKEND_BASE_URL_KEY = 'norish.backend-base-url';

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

    parsed.hash = '';
    parsed.search = '';

    return parsed.toString().replace(/\/+$/, '');
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
    throw new Error('Please enter a valid backend URL.');
  }

  await SecureStore.setItemAsync(BACKEND_BASE_URL_KEY, normalized);
  return normalized;
}

export function clearBackendBaseUrl(): Promise<void> {
  return SecureStore.deleteItemAsync(BACKEND_BASE_URL_KEY);
}

export function getBackendHealthUrl(baseUrl: string): string {
  return `${baseUrl}/api/health`;
}

export function getBackendTrpcUrl(baseUrl: string): string {
  return `${baseUrl}/api/trpc`;
}
