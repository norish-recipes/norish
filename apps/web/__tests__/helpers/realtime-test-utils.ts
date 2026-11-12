/**
 * What `useRealtimeSubscription` receives from the transport for one event:
 * the tracked item tRPC hands `onData` — a cursor beside the envelope.
 */

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";
import { ENVELOPE_VERSION } from "@norish/shared/contracts/realtime/envelope";

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
