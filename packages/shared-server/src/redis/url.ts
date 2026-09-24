/**
 * Redis URL parsing
 *
 * The one place a `REDIS_URL` is turned into ioredis connection options. Both
 * the pub/sub client and BullMQ's connection build on it, so a URL shape that
 * works for one works for the other: `redis://user:pass@host:6379/2` keeps
 * its username and database index, and `rediss://host` turns TLS on.
 */

import type { ConnectionOptions } from "node:tls";

export interface ParsedRedisUrl {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: ConnectionOptions;
}

const DEFAULT_PORT = 6379;

export function parseRedisUrl(url: string): ParsedRedisUrl {
  const parsed = new URL(url);

  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error(`Unsupported Redis URL scheme: ${parsed.protocol}`);
  }

  const result: ParsedRedisUrl = {
    host: parsed.hostname || "localhost",
    port: parsed.port ? parseInt(parsed.port, 10) : DEFAULT_PORT,
  };

  if (parsed.username) {
    result.username = decodeURIComponent(parsed.username);
  }

  if (parsed.password) {
    result.password = decodeURIComponent(parsed.password);
  }

  const dbSegment = parsed.pathname.replace(/^\//, "");

  if (dbSegment) {
    const db = Number(dbSegment);

    if (!Number.isInteger(db) || db < 0) {
      throw new Error(`Invalid Redis database index in URL: ${dbSegment}`);
    }

    result.db = db;
  }

  if (parsed.protocol === "rediss:") {
    result.tls = {};
  }

  return result;
}
