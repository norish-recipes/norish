/** Deterministic lock races: the test holds a lock, each operation is seen waiting, then it lets go. */
import { sql } from "drizzle-orm";

import { getTestDb } from "./db-test-helpers";

type TestTransaction = Parameters<Parameters<ReturnType<typeof getTestDb>["transaction"]>[0]>[0];

/** The backend running `tx`, as `lockWaits` names it. */
export async function backendPid(tx: TestTransaction): Promise<number> {
  return (await tx.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`)).rows[0]!.pid;
}

/** Backends of this suite's database waiting on a lock, each with the backends it waits on. */
export async function lockWaits(): Promise<Map<number, number[]>> {
  const { rows } = await getTestDb().execute<{ pid: number; blockers: number[] }>(
    sql`SELECT pid, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`
  );

  return new Map(rows.map((row) => [row.pid, row.blockers]));
}

/** Polls `found` until it answers, failing well inside Vitest's timeout so the caller's lock goes. */
export async function waitFor<T>(found: () => Promise<T | undefined>, what: string): Promise<T> {
  const deadline = Date.now() + 3000;

  for (;;) {
    const value = await found();

    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/**
 * The test's own transaction takes a lock with `hold` while `ops` start in order, each
 * confirmed waiting behind the holder or an op before it; then it releases.
 */
export async function raceBehind(
  hold: (tx: TestTransaction) => Promise<unknown>,
  ops: Array<() => Promise<unknown>>
): Promise<PromiseSettledResult<unknown>[]> {
  const started: Promise<unknown>[] = [];
  let settledRuns: PromiseSettledResult<unknown>[] = [];

  try {
    // A failed wait rolls the transaction back, releasing the lock for the started ops.
    await getTestDb().transaction(async (tx) => {
      await hold(tx);

      const queue = [await backendPid(tx)];

      for (const [index, op] of ops.entries()) {
        let settled = false;
        const run = op().finally(() => (settled = true));

        run.catch(() => undefined);
        started.push(run);

        const [waiter] = await waitFor(async () => {
          if (settled) throw new Error(`Operation ${index} finished without waiting on the lock`);

          return [...(await lockWaits())].find(
            ([pid, blockers]) =>
              !queue.includes(pid) &&
              blockers.length > 0 &&
              blockers.every((blocker) => queue.includes(blocker))
          );
        }, `operation ${index} to wait on the lock`);

        queue.push(waiter);
      }
    });
  } finally {
    // Started ops finish before the next test, whether or not the race held.
    settledRuns = await Promise.allSettled(started);
  }

  return settledRuns;
}
