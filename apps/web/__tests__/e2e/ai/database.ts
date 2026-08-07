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
