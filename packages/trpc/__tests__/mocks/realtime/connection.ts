/** Mock for @norish/shared-server/realtime/connection */
import { vi } from "vitest";

import { connectionRealtime } from "@norish/shared/contracts/realtime/connection";

import { createFakeRealtimeDomain } from "../realtime";

export const connection = createFakeRealtimeDomain(connectionRealtime);

export const emitConnectionInvalidation = vi.fn(async (userId: string, reason: string) => {
  await connection.publish("invalidate", { userId, reason }, undefined);
});
