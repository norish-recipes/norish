import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { SERVER_CONFIG } from "@norish/config/env-config-server";

import * as schema from "./schema";

const { Pool } = pg;

let _pool: pg.Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) {
    _pool = new Pool({
      connectionString: SERVER_CONFIG.DATABASE_URL,
    });
    _db = drizzle(_pool, { schema });
  }

  return _db;
}

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop, _receiver) {
    const instance = getDb();
    const value = instance[prop as keyof typeof instance];

    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export type DbTransaction = Parameters<
  Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]
>[0];

/** The connection a caller is already inside, or the shared one. */
export type Db = typeof db | DbTransaction;

/**
 * Run repository operations inside a single database transaction without
 * exposing the raw client to callers outside the db package.
 */
export async function withTransaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
  return await db.transaction(fn);
}

/** Hold an advisory lock on `key` until the transaction ends; a second holder waits for it. */
export async function holdLock(tx: DbTransaction, key: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}::text))`);
}

/**
 * Reset the database connection pool
 * This is primarily for testing - allows switching databases at runtime
 */
export async function resetDbConnection() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }

  _db = null;
}

export async function getDatabaseHealth() {
  try {
    await db.execute(sql`select 1`);

    return {
      status: "ok" as const,
    };
  } catch {
    return {
      status: "error" as const,
    };
  }
}
