import { TRPCClientError } from "@trpc/client";

import { isQueuedDeliveryError } from "./queued-delivery";

export function isBackendUnreachableError(error: unknown): boolean {
  if (isQueuedDeliveryError(error)) {
    return false;
  }

  if (error instanceof TRPCClientError) {
    return isNetworkError(error.cause) || (!hasHttpStatus(error) && !hasServerErrorShape(error));
  }

  return isNetworkError(error) || isFetchLikeNetworkError(error);
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
