import { Client } from "pg";

import { databaseUrl } from "./database";

/**
 * A Store pointing at the harness's own shop. Created straight in the
 * database: the paste-and-derive flow has its own unit tests, and what these
 * scenarios are about is what happens to a Grocery afterwards.
 */
export async function createShopStore(name: string, shopUrl: string): Promise<string> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    const owner = (
      await database.query<{ id: string }>(`select id from "user" order by "createdAt" asc limit 1`)
    ).rows[0];

    if (!owner) throw new Error("The harness has provisioned no accounts");
    const inserted = await database.query<{ id: string }>(
      `insert into stores (user_id, name, website, search_address)
       values ($1, $2, $3, $4)
       returning id`,
      [owner.id, name, shopUrl, `${shopUrl}/search?q={query}`]
    );

    return inserted.rows[0]!.id;
  } finally {
    await database.end();
  }
}

/** What the household's Stores have learned a grocery name means. */
export async function readStoredLink(
  name: string
): Promise<{ productName: string | null; price: string | null } | null> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    const rows = await database.query<{ name: string | null; price: string | null }>(
      `select p.name, p.price
         from store_product_links l
         left join store_products p on p.id = l.store_product_id
        where l.normalized_name = $1`,
      [name]
    );

    if (rows.rows.length === 0) return null;

    return { productName: rows.rows[0]?.name ?? null, price: rows.rows[0]?.price ?? null };
  } finally {
    await database.end();
  }
}

/** The stored requirement and purchase override, used to wait for the server write. */
export async function readGroceryAmount(
  name: string
): Promise<{ amount: number | null; purchaseAmount: number | null } | null> {
  const database = new Client({ connectionString: databaseUrl() });
  await database.connect();
  try {
    const result = await database.query<{ amount: string | null; purchase_amount: string | null }>(
      "select amount, purchase_amount from groceries where name = $1 order by created_at desc limit 1",
      [name]
    );
    const row = result.rows[0];
    return row
      ? {
          amount: row.amount === null ? null : Number(row.amount),
          purchaseAmount: row.purchase_amount === null ? null : Number(row.purchase_amount),
        }
      : null;
  } finally {
    await database.end();
  }
}

/** Which Store a grocery sits under, as the database has it. */
export async function readGroceryStore(name: string): Promise<string | null> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    const rows = await database.query<{ name: string | null }>(
      `select s.name
         from groceries g
         left join stores s on s.id = g.store_id
        where g.name = $1
        order by g.created_at desc
        limit 1`,
      [name]
    );

    return rows.rows[0]?.name ?? null;
  } finally {
    await database.end();
  }
}
