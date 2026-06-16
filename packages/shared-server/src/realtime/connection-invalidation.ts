import superjson from "superjson";

import { trpcLogger as log } from "@norish/shared-server/logger";
import { getPublisherClient } from "@norish/shared-server/redis/client";

export const CONNECTION_INVALIDATION_CHANNEL = "norish:connection:invalidate";

export type ConnectionInvalidationMessage = {
  userId: string;
  reason: string;
};

export async function emitConnectionInvalidation(userId: string, reason: string): Promise<void> {
  const client = await getPublisherClient();
  const message: ConnectionInvalidationMessage = { userId, reason };

  await client.publish(CONNECTION_INVALIDATION_CHANNEL, superjson.stringify(message));
  log.debug({ userId, reason }, "Emitted connection invalidation");
}
