/**
 * Recovery is the one convergence boundary for the web offline runtime.
 *
 * Every trigger shares the same operation: finish the current owner's Replay
 * batch (including bounded transient retries), refetch active server-backed
 * queries without clearing their visible data, then top the Warm Set up. A
 * transport/auth/identity halt leaves the local copy as-is for a later trigger.
 */

import type { OutboxStore } from "./outbox-store";
import type { ReplaySubmit } from "./replay";
import { runWithOutboxLock } from "./leader";
import { runReplayPass } from "./replay";

type SessionVerdict = "match" | "mismatch" | "unverifiable";

interface RecoveryDependencies {
  store: OutboxStore;
  owner: () => string | null;
  submit: ReplaySubmit;
  verifySession: (ownerId: string) => Promise<SessionVerdict>;
  refetchActiveQueries: () => Promise<unknown>;
  topUp: () => Promise<unknown>;
  wait?: (delayMs: number) => Promise<void>;
}

export interface Recovery {
  recover(): Promise<void>;
  isSyncing(): boolean;
  subscribe(listener: () => void): () => void;
}

const waitFor = (delayMs: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });

export function createRecovery({
  store,
  owner,
  submit,
  verifySession,
  refetchActiveQueries,
  topUp,
  wait = waitFor,
}: RecoveryDependencies): Recovery {
  let processing: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) listener();
  }

  async function replayToTerminalBatch(): Promise<boolean> {
    const batchOwner = owner();

    if (!batchOwner) {
      return false;
    }

    while (owner() === batchOwner) {
      const attempt = await runWithOutboxLock(async () => {
        if (owner() !== batchOwner) {
          return null;
        }

        let session: SessionVerdict = "unverifiable";

        try {
          session = await verifySession(batchOwner);
        } catch {
          // An unreachable session endpoint is not proof of an identity change;
          // Replay itself will classify the transport result.
        }

        if (session === "mismatch") {
          return null;
        }

        return runReplayPass({ store, submit, ownerId: batchOwner });
      });

      if (!attempt) {
        return false;
      }

      if (attempt.halted === "retry" && attempt.retryAfterMs !== null) {
        await wait(attempt.retryAfterMs);

        continue;
      }

      return attempt.halted === null;
    }

    return false;
  }

  async function run(): Promise<void> {
    if (!(await replayToTerminalBatch())) {
      return;
    }

    await refetchActiveQueries();
    await topUp();
  }

  return {
    recover() {
      if (processing) {
        return processing;
      }

      processing = run()
        .catch(() => undefined)
        .finally(() => {
          processing = null;
          notify();
        });
      notify();

      return processing;
    },

    isSyncing() {
      return processing !== null;
    },

    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
  };
}
