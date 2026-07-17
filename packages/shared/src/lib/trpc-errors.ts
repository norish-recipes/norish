import { TRPCClientError } from "@trpc/client";

import { isQueuedDeliveryError } from "./queued-delivery";

export function isBackendUnreachableError(error: unknown): boolean {
  if (isQueuedDeliveryError(error)) {
    return false;
  }

  if (error instanceof TRPCClientError) {
    return (
      isNetworkError(error.cause) ||
      hasBackendUnavailableStatus(error) ||
      (!hasHttpStatus(error) && !hasServerErrorShape(error))
    );
  }

  return (
    isNetworkError(error) || isFetchLikeNetworkError(error) || hasBackendUnavailableStatus(error)
  );
}

function hasBackendUnavailableStatus(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const value = error as {
    status?: unknown;
    data?: { httpStatus?: unknown };
    shape?: { data?: { httpStatus?: unknown } };
  };
  const status = value.status ?? value.data?.httpStatus ?? value.shape?.data?.httpStatus;

  return status === 502 || status === 503 || status === 504;
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

function isFetchLikeNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("failed to fetch") ||
    message.includes("connection refused") ||
    message.includes("econnrefused")
  );
}

function hasHttpStatus(error: TRPCClientError<any>): boolean {
  const data = error.data as Record<string, unknown> | undefined;

  return typeof data?.httpStatus === "number";
}

function hasServerErrorShape(error: TRPCClientError<any>): boolean {
  const data = error.data as Record<string, unknown> | undefined;
  const shapeData = error.shape?.data as Record<string, unknown> | undefined;

  return typeof data?.code === "string" || typeof shapeData?.code === "string";
}
