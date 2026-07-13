/** Error raised only after a web mutation has been durably persisted. */
export class QueuedDeliveryError extends Error {
  readonly code = "QUEUED_DELIVERY" as const;
  readonly operationId: string;
  readonly path: string;
  readonly entryId: string;

  constructor({
    operationId,
    path,
    entryId,
  }: {
    operationId: string;
    path: string;
    entryId: string;
  }) {
    super(`Mutation ${path} is queued for delivery`);
    this.name = "QueuedDeliveryError";
    this.operationId = operationId;
    this.path = path;
    this.entryId = entryId;
  }
}

export function isQueuedDeliveryError(error: unknown): error is QueuedDeliveryError {
  return isQueuedDeliveryErrorInternal(error, new Set());
}

function isQueuedDeliveryErrorInternal(error: unknown, seen: Set<object>): boolean {
  if (error instanceof QueuedDeliveryError) {
    return true;
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  if (seen.has(error)) {
    return false;
  }

  seen.add(error);

  if ((error as { code?: unknown }).code === "QUEUED_DELIVERY") {
    return true;
  }

  return isQueuedDeliveryErrorInternal((error as { cause?: unknown }).cause, seen);
}
