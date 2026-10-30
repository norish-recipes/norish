/**
 * Valkey Client Singleton
 *
 * The only module that opens a Valkey connection for pub/sub. The publisher is
 * a process-wide singleton; subscribers are duplicated from it because a Valkey
 * client in subscribe mode cannot run other commands.
 */

import type { RedisOptions } from "ioredis";
import Valkey from "ioredis";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { createLogger, redactUrl } from "@norish/shared-server/logger";
import { withTimeout } from "@norish/shared/lib/with-timeout";

import { parseValkeyUrl } from "./url";

const log = createLogger("valkey");

// Read on every access, never copied into a module-local — see the note on
// `globalForRegistry` in packages/queue/src/registry.ts for why this module is
// evaluated more than once per process. Here the cost of getting it wrong is
// one connection per instance, of which shutdown closes only the one it can see.
const globalForValkey = globalThis as unknown as {
  publisherClient: Valkey | null | undefined;
};

/**
 * A socket that has received nothing for this long after a command went out is
 * taken for dead and reconnected. Without it, a connection left half-open by a
 * Valkey restart is only noticed once the operating system's keep-alive gives
 * up, minutes later.
 */
export const VALKEY_SOCKET_TIMEOUT_MS = 10_000;

/**
 * Connection options every Valkey client in Norish starts from: the publisher,
 * each subscriber and BullMQ's connections. ioredis 6's defaults do the rest:
 * RESP3, reconnecting with capped exponential backoff for as long as the
 * process lives, and a 30-second keep-alive.
 */
export function getValkeyConnectionOptions(url = SERVER_CONFIG.VALKEY_URL): RedisOptions {
  return {
    ...parseValkeyUrl(url),
    lazyConnect: true,
    maxRetriesPerRequest: null,
    // How long a deliberate disconnect waits for the far end to close before
    // destroying the socket. Shutdown waits this long for every connection a
    // Valkey restart left unanswered; ioredis's two seconds overran its budget.
    disconnectTimeout: 200,
  };
}

/**
 * The publisher, for PUBLISH and every non-subscribe command. Created once per
 * process: while Valkey is down it reconnects, and callers keep getting it.
 */
export async function getPublisherClient(): Promise<Valkey> {
  return (globalForValkey.publisherClient ??= createPublisher());
}

function createPublisher(): Valkey {
  log.info({ url: redactUrl(SERVER_CONFIG.VALKEY_URL) }, "Connecting to Valkey");

  const client = new Valkey({
    ...getValkeyConnectionOptions(),
    // A command fails when Valkey has not answered it within five seconds, so
    // an outage cannot hold a request for ever, while a restart that takes a
    // second or two is waited out: a session read failed then reads as signed out.
    commandTimeout: 5_000,
    socketTimeout: VALKEY_SOCKET_TIMEOUT_MS,
    connectionName: `norish:${process.pid}:publisher`,
  });

  client.on("error", (err) => {
    log.error({ err }, "Valkey client error");
  });

  client.on("reconnecting", () => {
    log.warn("Valkey client reconnecting");
  });

  client.on("ready", () => {
    log.info("Valkey publisher connected");
  });

  return client;
}

const VALKEY_HEALTH_TIMEOUT_MS = 2_000;

/** PING through the publisher. A ping unanswered after two seconds counts as down. */
export async function getValkeyHealth() {
  try {
    const valkey = await getPublisherClient();

    await withTimeout(() => valkey.ping(), VALKEY_HEALTH_TIMEOUT_MS, "Valkey PING");

    return { status: "ok" as const };
  } catch {
    return { status: "error" as const };
  }
}

/**
 * Create the Realtime Hub's subscriber client, duplicated from the publisher
 * with its socket timeout. It needs its own connection because a Valkey client
 * in subscribe mode serves nothing else.
 */
export async function createSubscriberClient(): Promise<Valkey> {
  const publisher = await getPublisherClient();
  // A SUBSCRIBE waits out an outage rather than failing like a publisher's command.
  const subscriber = publisher.duplicate({
    commandTimeout: undefined,
    connectionName: `norish:${process.pid}:realtime-hub`,
  });

  subscriber.on("error", (err) => {
    log.error({ err }, "Valkey subscriber error");
  });

  log.trace("Valkey subscriber connected");

  return subscriber;
}

/**
 * Close the publisher. Shutdown calls this after every consumer has stopped,
 * so nothing is in flight: it disconnects rather than sending a QUIT that a
 * dead socket would never answer.
 */
export async function closeValkeyConnections(): Promise<void> {
  const publisherClient = globalForValkey.publisherClient;

  if (publisherClient && publisherClient.status !== "end") {
    log.info("Closing Valkey connections");
    publisherClient.disconnect();
    globalForValkey.publisherClient = null;
  }
}
