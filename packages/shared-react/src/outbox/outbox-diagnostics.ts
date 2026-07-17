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

export const WEB_OUTBOX_CHANGE_EVENT = "norish:web-outbox-changed";
const WEB_OUTBOX_CHANGE_CHANNEL = "norish-web-outbox";
const WEB_OUTBOX_TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2)}`;

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
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WEB_OUTBOX_CHANGE_EVENT));
  if (typeof BroadcastChannel === "undefined") return;

  const channel = new BroadcastChannel(WEB_OUTBOX_CHANGE_CHANNEL);

  channel.postMessage({ sourceId: WEB_OUTBOX_TAB_ID });
  channel.close();
}

export function subscribeToWebOutboxChanges(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const channel =
    typeof BroadcastChannel === "undefined"
      ? null
      : new BroadcastChannel(WEB_OUTBOX_CHANGE_CHANNEL);

  window.addEventListener(WEB_OUTBOX_CHANGE_EVENT, listener);
  if (channel) {
    channel.onmessage = (event: MessageEvent<{ sourceId?: string }>) => {
      if (event.data?.sourceId !== WEB_OUTBOX_TAB_ID) listener();
    };
  }

  return () => {
    window.removeEventListener(WEB_OUTBOX_CHANGE_EVENT, listener);
    channel?.close();
  };
}
