import { Client } from "pg";

import { databaseUrl } from "./database";

/**
 * A plain Store, with no shop behind it: aisles need none, and a Store with
 * no website is exactly as good a place for a route through the shop as a
 * priced one. Created straight in the database, like the priced scenarios'
 * shop Store; what these scenarios are about is what the list does afterwards.
 */
export async function createPlainStore(name: string): Promise<string> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    const owner = (
      await database.query<{ id: string }>(`select id from "user" order by "createdAt" asc limit 1`)
    ).rows[0];

    if (!owner) throw new Error("The harness has provisioned no accounts");
    const inserted = await database.query<{ id: string }>(
      `insert into stores (user_id, name) values ($1, $2) returning id`,
      [owner.id, name]
    );

    return inserted.rows[0]!.id;
  } finally {
    await database.end();
  }
}

/** The aisle a Store files a grocery name under, as the database has it, or null. */
export async function readAisleFiling(storeName: string, name: string): Promise<string | null> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    const rows = await database.query<{ name: string }>(
      `select a.name
         from aisle_links l
         join aisles a on a.id = l.aisle_id
         join stores s on s.id = l.store_id
        where s.name = $1 and l.normalized_name = $2`,
      [storeName, name]
    );

    return rows.rows[0]?.name ?? null;
  } finally {
    await database.end();
  }
}

/** A Store's aisle names, in the Store's order, as the database has them. */
export async function readStoreAisles(storeName: string): Promise<string[]> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    const rows = await database.query<{ name: string }>(
      `select a.name
         from aisles a
         join stores s on s.id = a.store_id
        where s.name = $1
        order by a.sort_order asc`,
      [storeName]
    );

    return rows.rows.map((row) => row.name);
  } finally {
    await database.end();
  }
}
