import type { WebOutboxScope } from "./outbox-types";
import { WebOutboxRepository } from "./outbox-repository";

export type WebOutboxDiagnostics = {
  pending: number;
  retrying: number;
  quarantined: number;
  terminal: number;
  expired: number;
  completed: number;
  discarded: number;
  attention: Array<{
    id: string;
    path: string;
    state: "quarantined" | "terminal" | "expired";
    code?: string;
    message?: string;
  }>;
};

const EMPTY_DIAGNOSTICS: WebOutboxDiagnostics = {
  pending: 0,
  retrying: 0,
  quarantined: 0,
  terminal: 0,
  expired: 0,
  completed: 0,
  discarded: 0,
  attention: [],
};

export async function readWebOutboxDiagnostics(
  repository: WebOutboxRepository,
  scope: WebOutboxScope | null
): Promise<WebOutboxDiagnostics> {
  if (!scope) return EMPTY_DIAGNOSTICS;

  try {
    const entries = await repository.list(scope);

    return entries.reduce<WebOutboxDiagnostics>(
      (result, entry) => {
        const next = { ...result, [entry.state]: result[entry.state] + 1 };

        if (
          entry.state === "quarantined" ||
          entry.state === "terminal" ||
          entry.state === "expired"
        ) {
          next.attention = [
            ...next.attention,
            {
              id: entry.id,
              path: entry.path,
              state: entry.state,
              code: entry.lastErrorCode,
              message: entry.lastErrorMessage,
            },
          ];
        }

        return next;
      },
      { ...EMPTY_DIAGNOSTICS }
    );
  } catch {
    return EMPTY_DIAGNOSTICS;
  }
}

export function notifyWebOutboxChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("norish:web-outbox-changed"));
  }
}
