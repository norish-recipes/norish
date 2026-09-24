/**
 * Operation Helpers
 *
 * Client-safe utilities for generating and managing operationIds. The
 * envelope predicates live beside the envelope, in
 * `@norish/shared/contracts/realtime/envelope`.
 *
 * These can be imported from `@norish/shared/lib/operation-helpers`.
 */

import type { OperationId } from "@norish/shared/contracts/realtime/envelope";

/**
 * Generate a client-minted id (UUID v4) that is safe to send to the server.
 *
 * Uses `crypto.randomUUID()` where available, falling back to a Math.random
 * UUID v4 for environments without the Web Crypto API: React Native / Hermes,
 * and browsers in an insecure context (a self-hosted deployment served over
 * plain `http://`). The fallback is a *valid* UUID so it still satisfies the
 * server's `z.uuid()` validation on client-minted entity ids (ADR-0003).
 */
export function createClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;

    return v.toString(16);
  });
}

/**
 * Generate a new operationId.
 *
 * Uses `crypto.randomUUID()` where available (browsers, Node.js) and falls back
 * to a Math.random-based UUID v4 for environments like React Native / Hermes
 * where the Web Crypto API is absent.
 */
export function generateOperationId(): OperationId {
  return createClientId() as OperationId;
}

/**
 * Check whether a value is a valid operationId string.
 * Accepts any non-empty string — the branded type is enforced at generation.
 */
export function isOperationId(value: unknown): value is OperationId {
  return typeof value === "string" && value.length > 0;
}
