/**
 * Shared retention contract for server receipts and the web mutation outbox.
 * Keeping this in the client-safe shared package prevents a queued operation
 * from outliving the receipt that can safely replay its response.
 */
export const DELIVERY_RETENTION_DAYS = 30;
export const DELIVERY_RETENTION_MS = DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function deliveryExpiresAt(createdAt: Date | number = Date.now()): Date {
  const timestamp = createdAt instanceof Date ? createdAt.getTime() : createdAt;

  return new Date(timestamp + DELIVERY_RETENTION_MS);
}

export function isDeliveryExpired(createdAt: Date | number, now = Date.now()): boolean {
  const timestamp = createdAt instanceof Date ? createdAt.getTime() : createdAt;

  return now >= timestamp + DELIVERY_RETENTION_MS;
}

export type DeliveryState =
  | "pending"
  | "retrying"
  | "quarantined"
  | "terminal"
  | "expired"
  | "completed"
  | "discarded";
