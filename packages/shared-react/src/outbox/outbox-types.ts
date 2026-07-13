import type { DeliveryState } from "@norish/shared/lib/delivery-retention";

export const WEB_OUTBOX_SCHEMA_VERSION = 2 as const;

export type WebOutboxPayloadKind = "superjson" | "form-data";

export type EncryptedPayload = {
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
};

export type WebOutboxEntry = {
  schemaVersion: typeof WEB_OUTBOX_SCHEMA_VERSION;
  id: string;
  backendOrigin: string;
  userId: string;
  operationId: string;
  path: string;
  payloadKind: WebOutboxPayloadKind;
  encryptedInput: EncryptedPayload;
  createdAt: number;
  creationOrder: number;
  attempts: number;
  nextRetryAt: number | null;
  state: DeliveryState;
  expiresAt: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  resultId?: string;
};

export type WebOutboxResult = {
  id: string;
  entryId: string;
  backendOrigin: string;
  userId: string;
  operationId: string;
  path: string;
  encryptedResponse: EncryptedPayload;
  createdAt: number;
};

export type WebOutboxScope = {
  backendOrigin: string;
  userId: string;
};
