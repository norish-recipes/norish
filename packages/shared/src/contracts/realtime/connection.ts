/**
 * Connection realtime catalogue: server-internal signals about live
 * WebSocket connections. A Scope Change (ADR-0033) is announced here so every
 * process closes the user's sockets with 4000 and the client resubscribes
 * under its new identity.
 */

import { z } from "zod";

import { defineRealtimeCatalogue } from "./catalogue";

export const connectionRealtime = defineRealtimeCatalogue("connection", {
  invalidate: {
    scope: "internal",
    payload: z.object({ userId: z.string(), reason: z.string() }),
  },
});

export type ConnectionRealtime = typeof connectionRealtime;
