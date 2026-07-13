import type { TRPCClientError, TRPCLink } from "@trpc/client";
import type { AnyTRPCRouter } from "@trpc/server";
import { observable } from "@trpc/server/observable";

import { QueuedDeliveryError } from "@norish/shared/lib/queued-delivery";
import { isBackendUnreachableError } from "@norish/shared/lib/trpc-errors";

import { notifyWebOutboxChanged } from "./outbox-diagnostics";
import { WebOutboxRepository } from "./outbox-repository";

export const WEB_OUTBOX_REPLAY_HEADER = "x-replay-origin";
export const WEB_OUTBOX_REPLAY_HEADER_VALUE = "web-outbox";

export type CreateWebOutboxLinkOptions = {
  repository: WebOutboxRepository;
  getUserId: () => Promise<string | null>;
  getBackendOrigin: () => string;
  enabled?: () => boolean;
  logger?: { warn: (meta: unknown, message: string) => void; debug: (message: string) => void };
};

function isReplayContext(context: unknown): boolean {
  if (!context || typeof context !== "object") return false;

  const value = context as { skipOutboxCapture?: unknown; headers?: Record<string, unknown> };

  return (
    value.skipOutboxCapture === true ||
    value.headers?.[WEB_OUTBOX_REPLAY_HEADER] === WEB_OUTBOX_REPLAY_HEADER_VALUE
  );
}

export function createWebOutboxLink<TRouter extends AnyTRPCRouter>(
  options: CreateWebOutboxLinkOptions
): TRPCLink<TRouter> {
  return () =>
    ({ op, next }) => {
      if (op.type !== "mutation") return next(op);

      return observable((observer) => {
        const subscription = next(op).subscribe({
          next: (value) => observer.next(value),
          error: async (error) => {
            if (
              options.enabled?.() !== false &&
              !isReplayContext(op.context) &&
              isBackendUnreachableError(error)
            ) {
              try {
                const userId = await options.getUserId();
                const operationId = (op.context as Record<string, unknown> | undefined)
                  ?.operationId;

                if (userId && typeof operationId === "string") {
                  const entry = await options.repository.enqueue({
                    backendOrigin: options.getBackendOrigin(),
                    userId,
                    operationId,
                    path: op.path,
                    input: op.input,
                  });

                  notifyWebOutboxChanged();
                  options.logger?.debug(`Queued unreachable mutation ${op.path}`);
                  observer.error(
                    new QueuedDeliveryError({
                      operationId,
                      path: op.path,
                      entryId: entry.id,
                    }) as unknown as TRPCClientError<TRouter>
                  );

                  return;
                }
              } catch (enqueueError) {
                options.logger?.warn(
                  { error: enqueueError, path: op.path },
                  "Web outbox enqueue failed"
                );
                observer.error(enqueueError as TRPCClientError<TRouter>);

                return;
              }
            }

            observer.error(error);
          },
          complete: () => observer.complete(),
        });

        return () => subscription.unsubscribe();
      });
    };
}
