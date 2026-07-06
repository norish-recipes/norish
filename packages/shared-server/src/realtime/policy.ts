import type { PermissionLevel } from "@norish/config/zod/server-config";
import type { TypedRedisEmitter } from "@norish/shared-server/redis/pubsub";
import { trpcLogger as log } from "@norish/shared-server/logger";

export interface PolicyEmitContext {
  userId: string;
  householdKey: string;
}

export function emitByPolicy<
  TEvents extends Record<string, unknown>,
  K extends keyof TEvents & string,
>(
  emitter: TypedRedisEmitter<TEvents>,
  viewPolicy: PermissionLevel,
  ctx: PolicyEmitContext,
  event: K,
  data: TEvents[K]
): void {
  log.debug(
    { event, viewPolicy, householdKey: ctx.householdKey, userId: ctx.userId },
    "Emitting event via policy"
  );

  switch (viewPolicy) {
    case "everyone":
      emitter.broadcast(event, data);
      log.debug({ event }, "Broadcast event emitted");
      break;
    case "household":
      emitter.emitToHousehold(ctx.householdKey, event, data);
      log.debug({ event, householdKey: ctx.householdKey }, "Household event emitted");
      break;
    case "owner":
      emitter.emitToUser(ctx.userId, event, data);
      log.debug({ event, userId: ctx.userId }, "User event emitted");
      break;
  }
}
