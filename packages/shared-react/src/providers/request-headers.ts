import type { HTTPHeaders } from "@trpc/client";

import { createClientLogger } from "@norish/shared/lib/logger";

import { OPERATION_ID_HEADER } from "./operation-id-link";

type OperationLike = {
  path?: string;
  type?: string;
  context?: Record<string, unknown>;
};

type HeaderValue = string | string[] | undefined;

type HeaderRecordLike = Record<string, HeaderValue>;

type HeaderIterableLike = Iterable<[string, string]>;

type HeaderForEachLike = {
  forEach: (callback: (value: string, key: string) => void) => void;
};

const log = createClientLogger("TrpcRequestHeaders");

function isHeaderIterable(source: unknown): source is HeaderIterableLike {
  return typeof source === "object" && source !== null && Symbol.iterator in source;
}

function isHeaderForEachLike(source: unknown): source is HeaderForEachLike {
  return typeof source === "object" && source !== null && "forEach" in source;
}

function appendHeaders(target: Record<string, string>, source?: HTTPHeaders): void {
  if (!source) {
    return;
  }

  if (isHeaderIterable(source)) {
    for (const [key, value] of source) {
      target[key] = value;
    }

    return;
  }

  if (isHeaderForEachLike(source)) {
    source.forEach((value, key) => {
      target[key] = value;
    });

    return;
  }

  for (const [key, value] of Object.entries(source as HeaderRecordLike)) {
    if (typeof value === "undefined") {
      continue;
    }

    target[key] = Array.isArray(value) ? value.join(", ") : value;
  }
}

function getOperationHeaders(op: OperationLike): HTTPHeaders | undefined {
  const headers = op.context?.headers;

  if (!headers || typeof headers !== "object") {
    return undefined;
  }

  return headers as HTTPHeaders;
}

export function mergeHttpHeaders(
  ...sources: Array<HTTPHeaders | undefined>
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const source of sources) {
    appendHeaders(headers, source);
  }

  return headers;
}

export function createRequestHeadersResolver(getHeaders: () => HTTPHeaders) {
  return ({ op }: { op: OperationLike }) => {
    const headers = mergeHttpHeaders(getHeaders(), getOperationHeaders(op));
    const operationId = headers[OPERATION_ID_HEADER];

    if (operationId) {
      log.debug(
        { path: op.path, type: op.type, operationId },
        "Sending tRPC request with correlation ID"
      );
    }

    return headers;
  };
}

export function createBatchRequestHeadersResolver(getHeaders: () => HTTPHeaders) {
  return ({ opList }: { opList: OperationLike[] }) =>
    mergeHttpHeaders(getHeaders(), ...opList.map((op) => getOperationHeaders(op)));
}
