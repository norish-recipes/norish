import { Client } from "pg";

/**
 * Run one unit of work against the stack's database and close the
 * connection whatever happens. Scenarios read server truth this way — a row's
 * version, a household's join code — rather than through the app.
 */
export async function withDatabase<T>(
  databaseUrl: string,
  run: (database: Client) => Promise<T>
): Promise<T> {
  const database = new Client({ connectionString: databaseUrl });

  await database.connect();

  try {
    return await run(database);
  } finally {
    await database.end();
  }
}
