import superjson from "superjson";

import { createClientLogger } from "@norish/shared/lib/logger";

import type { OutboxItem, OutboxRequestMetadata } from "./outbox-types";
import { isBackendUnreachableError } from "./error-classification";

export const OUTBOX_REPLAY_HEADER = "x-replay-origin";
export const OUTBOX_REPLAY_HEADER_VALUE = "mobile-outbox";

const log = createClientLogger("outbox-replay-client");

type TraversableClientNode = Record<string, unknown> | ((...args: never[]) => unknown);

export type OutboxMutationClient = TraversableClientNode;
export type OutboxReplayClient = OutboxMutationClient;

type ReplayContext = {
  operationId?: string;
  headers?: Record<string, string>;
  skipOutboxCapture: true;
};

export function isOutboxReplayContext(context: unknown): boolean {
  if (!context || typeof context !== "object") {
    return false;
  }

  const replayContext = context as {
    skipOutboxCapture?: unknown;
    headers?: Record<string, unknown>;
  };

  return (
    replayContext.skipOutboxCapture === true ||
    replayContext.headers?.[OUTBOX_REPLAY_HEADER] === OUTBOX_REPLAY_HEADER_VALUE
  );
}

function createReplayContext(request: OutboxRequestMetadata): ReplayContext {
  const headers = {
    ...request.headers,
    [OUTBOX_REPLAY_HEADER]: OUTBOX_REPLAY_HEADER_VALUE,
  };

  return {
    ...(request.operationId ? { operationId: request.operationId } : {}),
    headers,
    skipOutboxCapture: true,
  };
}

function isTraversableClientNode(value: unknown): value is TraversableClientNode {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function getMutationProcedure(client: OutboxMutationClient, path: string) {
  const procedure = path.split(".").reduce<unknown>((current, segment) => {
    if (!isTraversableClientNode(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, client);

  if (!isTraversableClientNode(procedure)) {
    return null;
  }

  const mutate = (procedure as { mutate?: unknown }).mutate;

  return typeof mutate === "function" ? mutate : null;
}

export async function replayOutboxItem(
  client: OutboxMutationClient,
  item: OutboxItem
): Promise<boolean> {
  try {
    const mutate = getMutationProcedure(client, item.path);

    if (!mutate) {
      log.warn({ itemId: item.id, path: item.path }, "Outbox replay mutation procedure not found");

      return false;
    }

    await mutate(superjson.parse(item.input), {
      context: createReplayContext(item.request),
    });

    return true;
  } catch (error) {
    if (!isBackendUnreachableError(error)) {
      log.debug(
        `Outbox replay delivered but backend returned an error for ${item.path}; removing item`
      );

      return true;
    }

    log.warn(
      { error, itemId: item.id, path: item.path, attempts: item.attempts + 1 },
      "Outbox replay mutation failed"
    );

    return false;
  }
}
