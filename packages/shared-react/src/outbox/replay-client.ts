import type { WebOutboxEntry } from "./outbox-types";
import { WEB_OUTBOX_REPLAY_HEADER, WEB_OUTBOX_REPLAY_HEADER_VALUE } from "./outbox-link";

type TraversableClientNode = Record<string, unknown> | ((...args: unknown[]) => unknown);

function isTraversable(value: unknown): value is TraversableClientNode {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function getMutationProcedure(
  client: unknown,
  path: string
): ((...args: unknown[]) => unknown) | null {
  const procedure = path.split(".").reduce<unknown>((current, segment) => {
    if (!isTraversable(current)) return undefined;

    return (current as Record<string, unknown>)[segment];
  }, client);

  if (!isTraversable(procedure)) return null;

  const mutate = (procedure as { mutate?: unknown }).mutate;

  return typeof mutate === "function" ? (mutate as (...args: unknown[]) => unknown) : null;
}

export async function replayWebOutboxEntry(
  client: unknown,
  entry: WebOutboxEntry,
  input: unknown
): Promise<unknown> {
  const mutate = getMutationProcedure(client, entry.path);

  if (!mutate) {
    throw new Error(`Outbox mutation procedure not found: ${entry.path}`);
  }

  return mutate(input, {
    context: {
      operationId: entry.operationId,
      skipOutboxCapture: true,
      headers: {
        [WEB_OUTBOX_REPLAY_HEADER]: WEB_OUTBOX_REPLAY_HEADER_VALUE,
      },
    },
  });
}
