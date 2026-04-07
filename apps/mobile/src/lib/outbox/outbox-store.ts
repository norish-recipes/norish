import { outboxStorage } from "@/lib/storage/outbox-mmkv";

import { createClientLogger } from "@norish/shared/lib/logger";

import type { OutboxItem, OutboxRequestMetadata } from "./outbox-types";

const log = createClientLogger("outbox-store");

/** MMKV key under which the outbox queue is persisted. */
const STORAGE_KEY = "outbox-queue";

function readQueue(): OutboxItem[] {
  try {
    const raw = outboxStorage.getString(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    return JSON.parse(raw) as OutboxItem[];
  } catch (error) {
    log.warn({ error }, "Failed to read outbox queue, resetting");
    outboxStorage.delete(STORAGE_KEY);

    return [];
  }
}

function writeQueue(items: OutboxItem[]): void {
  try {
    outboxStorage.set(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    log.warn({ error }, "Failed to write outbox queue");
  }
}

let idCounter = 0;

function generateId(): string {
  idCounter += 1;

  return `${Date.now()}-${idCounter}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Append a new item to the outbox queue.
 * The item is persisted immediately so it survives app restarts.
 */
export function enqueue(
  path: string,
  serializedInput: string,
  request: Partial<OutboxRequestMetadata> = {}
): OutboxItem {
  const item: OutboxItem = {
    id: generateId(),
    path,
    input: serializedInput,
    request: {
      operationId: request.operationId ?? null,
      headers: request.headers ?? {},
    },
    createdAt: new Date().toISOString(),
    attempts: 0,
    nextRetryAt: null,
  };

  const queue = readQueue();

  queue.push(item);
  writeQueue(queue);

  log.debug(`Enqueued mutation: ${path} (id=${item.id})`);

  return item;
}

/**
 * Load all pending outbox items in insertion order.
 */
export function loadAll(): OutboxItem[] {
  return readQueue();
}

/**
 * Update an existing outbox item in place (e.g. to bump retry metadata).
 * No-op if the item is not found.
 */
export function update(id: string, patch: Partial<Omit<OutboxItem, "id">>): void {
  const queue = readQueue();
  const index = queue.findIndex((item) => item.id === id);

  if (index === -1) {
    return;
  }

  queue[index] = { ...queue[index], ...patch };
  writeQueue(queue);
}

/**
 * Remove a single outbox item by ID.
 */
export function remove(id: string): void {
  const queue = readQueue();
  const filtered = queue.filter((item) => item.id !== id);

  if (filtered.length !== queue.length) {
    writeQueue(filtered);
    log.debug(`Removed outbox item: ${id}`);
  }
}

/**
 * Return the number of items currently in the outbox.
 */
export function size(): number {
  return readQueue().length;
}
