import { TRPCClientError } from "@trpc/client";

export function isBackendUnreachableError(error: unknown): boolean {
  if (error instanceof TRPCClientError) {
    return isNetworkError(error.cause) || httpStatusOf(error) === null;
  }

  return isNetworkError(error);
}

const OUTBOX_ADMISSION_FAILED = Symbol.for("norish.outboxAdmissionFailed");

/**
 * Stamp a backend-unreachable error whose Outbox admission did not durably
 * persist (ADR-0009). Consumers that would otherwise present the error as the
 * Queued outcome must treat a marked error as a real failure: the change was
 * neither delivered nor saved for Replay.
 */
export function markOutboxAdmissionFailed(error: unknown): void {
  if (error && (typeof error === "object" || typeof error === "function")) {
    (error as Record<PropertyKey, unknown>)[OUTBOX_ADMISSION_FAILED] = true;
  }
}

export function hasOutboxAdmissionFailed(error: unknown): boolean {
  if (!error || (typeof error !== "object" && typeof error !== "function")) {
    return false;
  }

  return (error as Record<PropertyKey, unknown>)[OUTBOX_ADMISSION_FAILED] === true;
}

/**
 * The Queued signal (design record: "Queued is a third outcome"): the backend
 * was unreachable and the mutation was durably admitted to the Outbox. A
 * marked admission failure is excluded — that change is lost unless retried.
 */
export function isQueuedOutboxSignal(error: unknown): boolean {
  return isBackendUnreachableError(error) && !hasOutboxAdmissionFailed(error);
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof TypeError)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("fetch failed") ||
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("load failed")
  );
}

/** The HTTP status a tRPC error carries in `error.data.httpStatus`, on `TRPCClientError` and plain shapes. */
export function httpStatusOf(error: unknown): number | null {
  const data = (error as { data?: { httpStatus?: unknown } } | null | undefined)?.data;

  return typeof data?.httpStatus === "number" ? data.httpStatus : null;
}
