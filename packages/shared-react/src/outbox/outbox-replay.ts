import { isQueuedDeliveryError } from "@norish/shared/lib/queued-delivery";
import { isBackendUnreachableError } from "@norish/shared/lib/trpc-errors";

import type { WebOutboxEntry, WebOutboxScope } from "./outbox-types";
import { isUnauthorizedTRPCError } from "../providers/trpc-links";
import { notifyWebOutboxChanged } from "./outbox-diagnostics";
import { WebOutboxRepository } from "./outbox-repository";

export type ReplayOutcome = "delivered" | "retry" | "auth" | "terminal";

const RETAINED_RESULT_PATHS = new Set(["user.apiKeys.create"]);

export type WebOutboxReplayCoordinatorOptions = {
  repository: WebOutboxRepository;
  getScope: () => Promise<WebOutboxScope | null>;
  deliver: (entry: WebOutboxEntry, input: unknown) => Promise<unknown>;
  refetch?: () => Promise<void> | void;
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
  private refetchRequested = false;
  private forceRetryRequested = false;

  constructor(private readonly options: WebOutboxReplayCoordinatorOptions) {}

  start(options: { refetchAfterPass?: boolean; forceRetry?: boolean } = {}): Promise<void> {
    if (options.refetchAfterPass) this.refetchRequested = true;
    if (options.forceRetry) this.forceRetryRequested = true;
    if (this.activePass) return this.activePass;

    this.activePass = this.run()
      .then(async (deliveredOrSettled) => {
        if (deliveredOrSettled || this.refetchRequested) {
          await this.options.refetch?.();
        }
      })
      .finally(() => {
        this.refetchRequested = false;
        this.forceRetryRequested = false;
        this.activePass = null;
      });

    return this.activePass;
  }

  private async run(): Promise<boolean> {
    const scope = await this.options.getScope();

    if (!scope) return false;

    let deliveredOrSettled = false;

    await this.options.repository.quarantineMismatches(scope);

    const entries = await this.options.repository.listPending(scope);

    for (const entry of entries) {
      if (
        !this.forceRetryRequested &&
        entry.nextRetryAt !== null &&
        entry.nextRetryAt > Date.now()
      ) {
        break;
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
        deliveredOrSettled = true;
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
          deliveredOrSettled = true;
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
          deliveredOrSettled = true;
          notifyWebOutboxChanged();
          continue;
        }

        await this.options.repository.markCompleted(
          entry,
          RETAINED_RESULT_PATHS.has(entry.path) ? response : undefined
        );
        deliveredOrSettled = true;
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
          break;
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
          break;
        }

        await this.options.repository.update(entry.id, {
          state: "terminal",
          nextRetryAt: null,
          lastErrorCode: getTerminalErrorCode(error),
          lastErrorMessage: error instanceof Error ? error.message : "Queued mutation failed",
        });
        deliveredOrSettled = true;
        notifyWebOutboxChanged();
      }
    }

    return deliveredOrSettled;
  }
}
