import { isQueuedDeliveryError } from "@norish/shared/lib/queued-delivery";
import { isBackendUnreachableError } from "@norish/shared/lib/trpc-errors";

import type { WebOutboxEntry, WebOutboxScope } from "./outbox-types";
import { isUnauthorizedTRPCError } from "../providers/trpc-links";
import { notifyWebOutboxChanged } from "./outbox-diagnostics";
import { WebOutboxRepository } from "./outbox-repository";

export type ReplayOutcome = "delivered" | "retry" | "auth" | "terminal";

type ReplayPassResult = {
  changed: boolean;
  safeToReconcile: boolean;
};

const RETAINED_RESULT_PATHS = new Set(["user.apiKeys.create"]);

export type WebOutboxReplayCoordinatorOptions = {
  repository: WebOutboxRepository;
  getScope: () => Promise<WebOutboxScope | null>;
  deliver: (entry: WebOutboxEntry, input: unknown) => Promise<unknown>;
  reconcile?: () => Promise<void> | void;
  maxBackoffMs?: number;
  logger?: {
    warn: (meta: unknown, message: string) => void;
    debug: (meta: unknown, message: string) => void;
  };
};

function getRetryDelay(attempt: number, maxBackoffMs: number): number {
  return Math.min(maxBackoffMs, 1000 * 2 ** Math.min(attempt, 6));
}

function isRetryableReceiptError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const data = (error as { data?: { code?: unknown }; shape?: { data?: { code?: unknown } } }).data;
  const shape = (error as { shape?: { data?: { code?: unknown } } }).shape;

  return data?.code === "TIMEOUT" || shape?.data?.code === "TIMEOUT";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getTRPCErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  const value = error as {
    data?: { code?: unknown };
    shape?: { data?: { code?: unknown } };
  };
  const code = value.data?.code ?? value.shape?.data?.code;

  return typeof code === "string" ? code : null;
}

function getTerminalErrorCode(error: unknown): string {
  const code = getTRPCErrorCode(error);

  if (code === "CONFLICT") return "CONFLICT";
  if (code === "PRECONDITION_FAILED") return "STALE_VERSION";

  return "DOMAIN_ERROR";
}

export function classifyReplayError(error: unknown): ReplayOutcome {
  if (
    isQueuedDeliveryError(error) ||
    isBackendUnreachableError(error) ||
    isRetryableReceiptError(error)
  ) {
    return "retry";
  }

  if (isUnauthorizedTRPCError(error)) {
    return "auth";
  }

  return "terminal";
}

export class WebOutboxReplayCoordinator {
  private activePass: Promise<void> | null = null;
  private invalidationRequested = false;
  private forceRetryRequested = false;

  constructor(private readonly options: WebOutboxReplayCoordinatorOptions) {}

  start(options: { invalidateAfterPass?: boolean; forceRetry?: boolean } = {}): Promise<void> {
    if (options.invalidateAfterPass) this.invalidationRequested = true;
    if (options.forceRetry) this.forceRetryRequested = true;
    if (this.activePass) {
      if (!options.invalidateAfterPass && !options.forceRetry) return this.activePass;

      const activePass = this.activePass;

      return activePass.then(() => {
        if (this.invalidationRequested || this.forceRetryRequested) return this.start();

        return this.activePass ?? undefined;
      });
    }

    const invalidateAfterPass = this.invalidationRequested;
    const forceRetry = this.forceRetryRequested;

    this.invalidationRequested = false;
    this.forceRetryRequested = false;
    this.activePass = this.run(forceRetry)
      .then(async ({ changed, safeToReconcile }) => {
        if (safeToReconcile && (changed || invalidateAfterPass)) {
          await this.options.reconcile?.();
        }
      })
      .finally(() => {
        this.activePass = null;
      });

    return this.activePass;
  }

  private async run(forceRetry: boolean): Promise<ReplayPassResult> {
    const scope = await this.options.getScope();

    if (!scope) return { changed: false, safeToReconcile: false };

    let changed = false;

    await this.options.repository.quarantineMismatches(scope);

    const entries = await this.options.repository.listPending(scope);

    for (const entry of entries) {
      if (!forceRetry && entry.nextRetryAt !== null && entry.nextRetryAt > Date.now()) {
        return { changed, safeToReconcile: false };
      }

      let input: unknown;

      try {
        input = await this.options.repository.decodeInput(entry);
      } catch (error) {
        this.options.logger?.warn({ error, entryId: entry.id }, "Unable to decrypt outbox input");
        await this.options.repository.update(entry.id, {
          state: "terminal",
          lastErrorCode: "LOCAL_DECRYPTION_FAILED",
          lastErrorMessage: "The queued mutation could not be decrypted",
        });
        changed = true;
        continue;
      }

      try {
        const response = await this.options.deliver(entry, input);

        if (isRecord(response) && response.stale === true) {
          await this.options.repository.update(entry.id, {
            state: "terminal",
            nextRetryAt: null,
            lastErrorCode: "STALE_VERSION",
            lastErrorMessage: "The queued mutation was based on an older version",
          });
          changed = true;
          notifyWebOutboxChanged();
          continue;
        }

        if (isRecord(response) && response.success === false) {
          await this.options.repository.update(entry.id, {
            state: "terminal",
            nextRetryAt: null,
            lastErrorCode: "DOMAIN_REJECTED",
            lastErrorMessage: "The server rejected the queued mutation",
          });
          changed = true;
          notifyWebOutboxChanged();
          continue;
        }

        await this.options.repository.markCompleted(
          entry,
          RETAINED_RESULT_PATHS.has(entry.path) ? response : undefined
        );
        changed = true;
        notifyWebOutboxChanged();
      } catch (error) {
        const outcome = classifyReplayError(error);

        if (outcome === "auth") {
          await this.options.repository.update(entry.id, {
            state: "quarantined",
            nextRetryAt: null,
            lastErrorCode: "UNAUTHORIZED",
            lastErrorMessage: "Authentication is required before queued delivery can continue",
          });
          notifyWebOutboxChanged();

          return { changed, safeToReconcile: false };
        }

        if (outcome === "retry") {
          const attempts = entry.attempts + 1;

          await this.options.repository.update(entry.id, {
            state: "retrying",
            attempts,
            nextRetryAt: Date.now() + getRetryDelay(attempts, this.options.maxBackoffMs ?? 60_000),
            lastErrorCode: "DELIVERY_RETRY",
            lastErrorMessage: "The backend did not accept the delivery yet",
          });
          this.options.logger?.debug({ entryId: entry.id, attempts }, "Outbox delivery backed off");

          return { changed, safeToReconcile: false };
        }

        await this.options.repository.update(entry.id, {
          state: "terminal",
          nextRetryAt: null,
          lastErrorCode: getTerminalErrorCode(error),
          lastErrorMessage: error instanceof Error ? error.message : "Queued mutation failed",
        });
        changed = true;
        notifyWebOutboxChanged();
      }
    }

    return { changed, safeToReconcile: true };
  }
}
