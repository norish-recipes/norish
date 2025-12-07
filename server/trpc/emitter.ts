/**
 * Typed Event Emitter for tRPC Subscriptions
 *
 * This module re-exports the Redis-backed TypedEmitter.
 * The API remains the same as the original EventEmitter-based implementation.
 *
 * @example
 * ```ts
 * type MyEvents = {
 *   created: { id: string };
 *   updated: { id: string; name: string };
 * };
 *
 * const emitter = createTypedEmitter<MyEvents>();
 *
 * // Emit to specific household
 * emitter.emitToHousehold(householdId, "created", { id: "123" });
 *
 * // Emit to specific user
 * emitter.emitToUser(userId, "updated", { id: "123", name: "Test" });
 *
 * // Emit to everyone
 * emitter.broadcast("created", { id: "123" });
 *
 * // Emit globally (for server-side listeners like CalDAV sync)
 * emitter.emitGlobal("created", { id: "123", userId: "user-1" });
 *
 * // Listen with .on() pattern
 * emitter.on(emitter.globalEvent("created"), (data) => { ... });
 *
 * // Listen with async iterator (for tRPC subscriptions)
 * for await (const data of emitter.createSubscription(channel, signal)) { ... }
 * ```
 */

export { TypedRedisEmitter as TypedEmitter, createTypedEmitter } from "@/server/redis/pubsub";
