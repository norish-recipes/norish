/**
 * Mock for @norish/db/drizzle: each transaction is TX, for the mocked repositories to ignore.
 */
export const TX = { tx: true };

export const withTransaction = (run: (tx: unknown) => unknown) => run(TX);
