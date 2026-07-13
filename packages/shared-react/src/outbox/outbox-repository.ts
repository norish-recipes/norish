import superjson from "superjson";

import { deliveryExpiresAt, isDeliveryExpired } from "@norish/shared/lib/delivery-retention";
import { generateOperationId } from "@norish/shared/lib/operation-helpers";

import type {
  EncryptedPayload,
  WebOutboxEntry,
  WebOutboxResult,
  WebOutboxScope,
} from "./outbox-types";
import { decryptOutboxPayload, encryptOutboxPayload } from "./crypto";
import {
  openWebOutboxDatabase,
  OUTBOX_STORES,
  requestResult,
  waitForTransaction,
} from "./database";
import { WEB_OUTBOX_SCHEMA_VERSION } from "./outbox-types";
import { decodeMutationInput, encodeMutationInput } from "./payload-codecs";

export type EnqueueWebOutboxInput = {
  backendOrigin: string;
  userId: string;
  operationId: string;
  path: string;
  input: unknown;
  now?: number;
};

export const MAX_WEB_OUTBOX_PAYLOAD_BYTES = 50 * 1024 * 1024;

export class WebOutboxStorageError extends Error {
  readonly code = "OUTBOX_STORAGE_UNAVAILABLE" as const;
}

function toStorageError(error: unknown): WebOutboxStorageError {
  if (error instanceof WebOutboxStorageError) return error;

  const message =
    error instanceof Error ? error.message : "The browser could not persist the queued mutation";

  return new WebOutboxStorageError(message);
}

function sortByCreationOrder(left: WebOutboxEntry, right: WebOutboxEntry): number {
  return left.creationOrder - right.creationOrder;
}

function isPending(entry: WebOutboxEntry): boolean {
  return entry.state === "pending" || entry.state === "retrying";
}

export class WebOutboxRepository {
  constructor(private readonly maxPayloadBytes = MAX_WEB_OUTBOX_PAYLOAD_BYTES) {}

  async enqueue(input: EnqueueWebOutboxInput): Promise<WebOutboxEntry> {
    const now = input.now ?? Date.now();
    let encoded: Awaited<ReturnType<typeof encodeMutationInput>>;

    try {
      encoded = await encodeMutationInput(input.input);
    } catch (error) {
      throw toStorageError(error);
    }
    const payloadBytes = new TextEncoder().encode(encoded.serialized).byteLength;

    if (payloadBytes > this.maxPayloadBytes) {
      throw new WebOutboxStorageError(
        `Mutation payload exceeds the ${this.maxPayloadBytes}-byte durable delivery limit`
      );
    }

    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      let estimate: StorageEstimate;

      try {
        estimate = await navigator.storage.estimate();
      } catch (error) {
        throw toStorageError(error);
      }

      if (
        typeof estimate.quota === "number" &&
        typeof estimate.usage === "number" &&
        estimate.usage + payloadBytes > estimate.quota
      ) {
        throw new WebOutboxStorageError(
          "Browser storage quota is insufficient for durable delivery"
        );
      }
    }

    let encryptedInput: EncryptedPayload;

    try {
      encryptedInput = await encryptOutboxPayload(encoded.serialized);
    } catch (error) {
      throw toStorageError(error);
    }
    const entry: WebOutboxEntry = {
      schemaVersion: WEB_OUTBOX_SCHEMA_VERSION,
      id: generateOperationId(),
      backendOrigin: input.backendOrigin,
      userId: input.userId,
      operationId: input.operationId,
      path: input.path,
      payloadKind: encoded.kind,
      encryptedInput,
      createdAt: now,
      creationOrder: now,
      attempts: 0,
      nextRetryAt: null,
      state: "pending",
      expiresAt: deliveryExpiresAt(now).getTime(),
    };
    let database: IDBDatabase;

    try {
      database = await openWebOutboxDatabase();
    } catch (error) {
      throw toStorageError(error);
    }

    try {
      const transaction = database.transaction(OUTBOX_STORES.entries, "readwrite");
      const store = transaction.objectStore(OUTBOX_STORES.entries);
      const existing = (await requestResult(store.getAll())) as WebOutboxEntry[];
      const duplicate = (await requestResult(
        store
          .index("operationKey")
          .get([input.backendOrigin, input.userId, input.operationId, input.path])
      )) as WebOutboxEntry | undefined;

      if (duplicate) {
        return duplicate;
      }

      const maxOrder = existing.reduce(
        (maximum, current) => Math.max(maximum, current.creationOrder),
        now - 1
      );

      entry.creationOrder = Math.max(now, maxOrder + 1);
      store.add(entry);
      await waitForTransaction(transaction);

      return entry;
    } catch (error) {
      if (
        typeof DOMException !== "undefined" &&
        error instanceof DOMException &&
        error.name === "ConstraintError"
      ) {
        const duplicateDatabase = await openWebOutboxDatabase();

        try {
          const lookupTransaction = duplicateDatabase.transaction(
            OUTBOX_STORES.entries,
            "readonly"
          );
          const duplicate = (await requestResult(
            lookupTransaction
              .objectStore(OUTBOX_STORES.entries)
              .index("operationKey")
              .get([input.backendOrigin, input.userId, input.operationId, input.path])
          )) as WebOutboxEntry | undefined;

          if (duplicate) return duplicate;
        } finally {
          duplicateDatabase.close();
        }
      }

      throw toStorageError(error);
    } finally {
      database.close();
    }
  }

  async decodeInput(entry: WebOutboxEntry): Promise<unknown> {
    return decodeMutationInput(entry.payloadKind, await decryptOutboxPayload(entry.encryptedInput));
  }

  async list(scope?: WebOutboxScope): Promise<WebOutboxEntry[]> {
    const database = await openWebOutboxDatabase();

    try {
      const transaction = database.transaction(OUTBOX_STORES.entries, "readonly");
      const entries = (await requestResult(
        transaction.objectStore(OUTBOX_STORES.entries).getAll()
      )) as WebOutboxEntry[];

      return entries
        .filter((entry) =>
          scope
            ? entry.backendOrigin === scope.backendOrigin && entry.userId === scope.userId
            : true
        )
        .sort(sortByCreationOrder);
    } finally {
      database.close();
    }
  }

  async listPending(scope: WebOutboxScope, now = Date.now()): Promise<WebOutboxEntry[]> {
    const entries = await this.list(scope);

    for (const entry of entries) {
      if (
        entry.state === "quarantined" &&
        (entry.lastErrorCode === "UNAUTHORIZED" ||
          entry.lastErrorCode === "ORIGIN_OR_USER_MISMATCH")
      ) {
        await this.update(entry.id, { state: "pending", nextRetryAt: null });
        entry.state = "pending";
        entry.nextRetryAt = null;
      }
    }

    const pending = entries.filter(isPending);

    for (const entry of pending) {
      if (isDeliveryExpired(entry.createdAt, now)) {
        await this.update(entry.id, {
          state: "expired",
          nextRetryAt: null,
          lastErrorCode: "LOCAL_EXPIRED",
          lastErrorMessage: "The queued mutation exceeded its delivery window",
        });
        entry.state = "expired";
      }
    }

    return pending.filter(isPending);
  }

  async update(id: string, changes: Partial<WebOutboxEntry>): Promise<boolean> {
    const database = await openWebOutboxDatabase();

    try {
      const transaction = database.transaction(OUTBOX_STORES.entries, "readwrite");
      const store = transaction.objectStore(OUTBOX_STORES.entries);
      const current = (await requestResult(store.get(id))) as WebOutboxEntry | undefined;

      if (!current) return false;

      store.put({ ...current, ...changes });
      await waitForTransaction(transaction);

      return true;
    } finally {
      database.close();
    }
  }

  async markCompleted(entry: WebOutboxEntry, response?: unknown): Promise<void> {
    let resultId: string | undefined;

    if (response !== undefined) {
      // Keep the result key stable across a crash between result persistence
      // and marking the queue entry completed.
      resultId = entry.resultId ?? `${entry.id}:result`;
      const encryptedResponse = await encryptOutboxPayload(superjson.stringify(response));
      const result: WebOutboxResult = {
        id: resultId,
        entryId: entry.id,
        backendOrigin: entry.backendOrigin,
        userId: entry.userId,
        operationId: entry.operationId,
        path: entry.path,
        encryptedResponse,
        createdAt: Date.now(),
      };
      const database = await openWebOutboxDatabase();

      try {
        const transaction = database.transaction(OUTBOX_STORES.results, "readwrite");

        transaction.objectStore(OUTBOX_STORES.results).put(result);
        await waitForTransaction(transaction);
      } finally {
        database.close();
      }
    }

    const database = await openWebOutboxDatabase();

    try {
      const transaction = database.transaction(OUTBOX_STORES.entries, "readwrite");

      transaction.objectStore(OUTBOX_STORES.entries).delete(entry.id);
      await waitForTransaction(transaction);
    } finally {
      database.close();
    }
  }

  async listResults(scope: WebOutboxScope): Promise<WebOutboxResult[]> {
    const database = await openWebOutboxDatabase();

    try {
      const transaction = database.transaction(OUTBOX_STORES.results, "readonly");
      const results = (await requestResult(
        transaction.objectStore(OUTBOX_STORES.results).getAll()
      )) as WebOutboxResult[];

      return results.filter(
        (result) => result.backendOrigin === scope.backendOrigin && result.userId === scope.userId
      );
    } finally {
      database.close();
    }
  }

  async consumeResult(result: WebOutboxResult): Promise<unknown> {
    const response = await this.readResult(result);
    const database = await openWebOutboxDatabase();

    try {
      const transaction = database.transaction(OUTBOX_STORES.results, "readwrite");

      transaction.objectStore(OUTBOX_STORES.results).delete(result.id);
      await waitForTransaction(transaction);
    } finally {
      database.close();
    }

    return response;
  }

  async readResult(result: WebOutboxResult): Promise<unknown> {
    const response = await decryptOutboxPayload(result.encryptedResponse);

    return superjson.parse(response);
  }

  async quarantineMismatches(scope: WebOutboxScope): Promise<number> {
    const entries = await this.list();
    let changed = 0;

    for (const entry of entries) {
      if (
        isPending(entry) &&
        (entry.backendOrigin !== scope.backendOrigin || entry.userId !== scope.userId)
      ) {
        if (
          await this.update(entry.id, {
            state: "quarantined",
            nextRetryAt: null,
            lastErrorCode: "ORIGIN_OR_USER_MISMATCH",
            lastErrorMessage: "The queued mutation belongs to another signed-in user or backend",
          })
        ) {
          changed += 1;
        }
      }
    }

    return changed;
  }

  async discard(id: string): Promise<boolean> {
    return this.update(id, { state: "discarded", nextRetryAt: null });
  }
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    value !== undefined &&
    "iv" in value &&
    "ciphertext" in value
  );
}
