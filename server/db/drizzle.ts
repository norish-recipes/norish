import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

import { SERVER_CONFIG } from "@/config/env-config-server";

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

/**
 * Gracefully close the database connection pool
 * Should be called during server shutdown
 */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}
