import { TRPCClientError } from "@trpc/client";

export function isBackendUnreachableError(error: unknown): boolean {
  if (error instanceof TRPCClientError) {
    return isNetworkError(error.cause) || !hasHttpStatus(error);
  }

  return isNetworkError(error);
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

function hasHttpStatus(error: TRPCClientError<any>): boolean {
  const data = error.data as Record<string, unknown> | undefined;

  return typeof data?.httpStatus === "number";
}
