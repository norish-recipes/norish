import { Client } from "pg";

let activeDatabaseUrl: string | null = null;

export function configureDatabase(url: string): void {
  activeDatabaseUrl = url;
}

export function databaseUrl(): string {
  if (!activeDatabaseUrl) {
    throw new Error("The AI browser fixture has not provisioned its database");
  }

  return activeDatabaseUrl;
}

/**
 * One connection to the provisioned database for one piece of work, closed
 * however that work ends. A support module reaching past the app to seed or
 * read a scenario's state asks for this rather than opening its own.
 */
export async function withDatabase<T>(run: (database: Client) => Promise<T>): Promise<T> {
  const database = new Client({ connectionString: databaseUrl() });

  await database.connect();

  try {
    return await run(database);
  } finally {
    await database.end();
  }
}
