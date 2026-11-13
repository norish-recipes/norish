/**
 * What `useRealtimeSubscription` receives from the transport for one event:
 * the tracked item tRPC hands `onData` — a cursor beside the envelope.
 */

import type { Mock } from "vitest";
import { act } from "react";

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";
import { CURSOR_MARK, ENVELOPE_VERSION } from "@norish/shared/contracts/realtime/envelope";

export function realtimeEnvelope<P>(payload: P, eventName = "event"): RealtimeEventEnvelope<P> {
  return {
    meta: {
      version: ENVELOPE_VERSION,
      eventId: "1700000000000-0",
      eventName,
      namespace: "test",
      scope: "household",
      channel: `norish:test:household:hh-1:${eventName}`,
      occurredAt: "2026-09-18T00:00:00.000Z",
    },
    payload,
  };
}

export function trackedEvent<P>(payload: P, eventName?: string) {
  return { id: "1.abcdef01.1700000000000-0", data: realtimeEnvelope(payload, eventName) };
}

/** The Cursor Mark that opens every subscription, as tRPC hands it `onData`. */
export function trackedCursorMark() {
  return { id: "1.abcdef01.1700000000000-0", data: CURSOR_MARK };
}

/** Delivers one event through the subscription the mocked `useSubscription` saw last. */
export function emitTrackedEvent(useSubscriptionMock: Mock, payload: unknown) {
  const { onData } = useSubscriptionMock.mock.calls.at(-1)?.[0] as {
    onData: (data: unknown) => void;
  };

  act(() => onData(trackedEvent(payload)));
}
