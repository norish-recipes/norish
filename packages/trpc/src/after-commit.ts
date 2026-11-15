import { trpcLogger as log } from "@norish/shared-server/logger";

/** Runs work that follows a committed write; a failure is logged, never turned into a failed write. */
export async function afterCommit<T>(
  ctx: { user: { id: string } },
  what: string,
  work: () => Promise<T>
): Promise<T | undefined> {
  try {
    return await work();
  } catch (err) {
    log.error({ err, userId: ctx.user.id }, `Failed after the commit: ${what}`);

    return undefined;
  }
}
