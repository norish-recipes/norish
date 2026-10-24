/**
 * Valkey URL parsing
 *
 * The one place a `VALKEY_URL` is turned into ioredis connection options. Both
 * the pub/sub client and BullMQ's connection build on it, so a URL shape that
 * works for one works for the other: `valkey://user:pass@host:6379/2` keeps
 * its username and database index, and `valkeys://host` turns TLS on.
 */

import type { ConnectionOptions } from "node:tls";

export interface ParsedValkeyUrl {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: ConnectionOptions;
}

const DEFAULT_PORT = 6379;

export function parseValkeyUrl(url: string): ParsedValkeyUrl {
  const parsed = new URL(url);

  if (parsed.protocol !== "valkey:" && parsed.protocol !== "valkeys:") {
    throw new Error(
      `Unsupported Valkey URL scheme: ${parsed.protocol} (use valkey:// or valkeys://)`
    );
  }

  const result: ParsedValkeyUrl = {
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
      throw new Error(`Invalid Valkey database index in URL: ${dbSegment}`);
    }

    result.db = db;
  }

  if (parsed.protocol === "valkeys:") {
    result.tls = {};
  }

  return result;
}
