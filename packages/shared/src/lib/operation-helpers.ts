/**
 * Operation Helpers
 *
 * Client-safe utilities for generating and managing operationIds,
 * and normalizing subscription data into the { meta, payload } shape.
 *
 * These can be imported from `@norish/shared/lib/operation-helpers`.
 */

import type {
  NormalizedSubscriptionData,
  OperationId,
  RealtimeEventEnvelope,
  RealtimeEventMeta,
} from "@norish/shared/contracts/realtime-envelope";

/**
 * Generate a new operationId.
 *
 * Uses `crypto.randomUUID()` where available (browsers, Node.js).
 * Falls back to a Math.random-based UUID v4 for environments like
 * React Native / Hermes where the Web Crypto API is absent.
 */
export function generateOperationId(): OperationId {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID() as OperationId;
  }

  // Fallback UUID v4 — sufficient for correlation IDs
  // Doesn't matter if it is an invalid GUID as long as it is unique.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;

    return v.toString(16);
  }) as OperationId;
}

/**
 * Check whether a value is a valid operationId string.
 * Accepts any non-empty string — the branded type is enforced at generation.
 */
export function isOperationId(value: unknown): value is OperationId {
  return typeof value === "string" && value.length > 0;
}

/**
 * Determine if the given data looks like a RealtimeEventEnvelope.
 *
 * Checks for the presence of `meta.version` and `payload` to distinguish
 * enveloped data from raw domain payloads.
 */
export function isEventEnvelope<T = unknown>(data: unknown): data is RealtimeEventEnvelope<T> {
  if (data == null || typeof data !== "object") return false;

  const candidate = data as Record<string, unknown>;

  if (!("meta" in candidate && "payload" in candidate)) return false;

  const meta = candidate.meta;

  if (meta == null || typeof meta !== "object") return false;

  return "version" in (meta as Record<string, unknown>);
}

/**
 * Normalize subscription data from either an envelope or a raw payload.
 *
 * - If `data` is a `RealtimeEventEnvelope`, returns `{ meta, payload }`.
 * - If `data` is a raw domain payload, returns `{ meta: null, payload: data }`.
 *
 * This allows existing `onData` handlers to continue working with `payload`
 * while envelope-aware consumers can also inspect `meta`.
 */
export function normalizeSubscriptionData<T = unknown>(
  data: unknown
): NormalizedSubscriptionData<T> {
  if (isEventEnvelope<T>(data)) {
    return { meta: data.meta, payload: data.payload };
  }

  return { meta: null, payload: data as T };
}

/**
 * Extract just the payload from data that may or may not be enveloped.
 * Useful as a compatibility shim for existing payload-only consumers.
 */
export function unwrapPayload<T = unknown>(data: unknown): T {
  if (isEventEnvelope<T>(data)) {
    return data.payload;
  }

  return data as T;
}

/**
 * Extract envelope meta from data, returning null if not enveloped.
 */
export function extractMeta(data: unknown): RealtimeEventMeta | null {
  if (isEventEnvelope(data)) {
    return data.meta;
  }

  return null;
}
