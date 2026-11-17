import { TRPCClientError } from "@trpc/client";

/** The server answered that the thing is gone, or was never the caller's to open. */
export const isNotFoundError = (error: unknown) =>
  error instanceof TRPCClientError && error.data?.code === "NOT_FOUND";

/** Query `retry`: a NOT_FOUND is final, anything else gets one more try. */
export const retryUnlessNotFound = (failures: number, error: unknown) =>
  !isNotFoundError(error) && failures < 1;
