import { z } from "zod";

/**
 * Standard acknowledgement for write mutations.
 *
 * - `applied: true` — the mutation's authoritative DB write committed before this
 *   response was produced.
 * - `applied: false, stale: true` — a version check rejected the write as stale;
 *   the caller should reconcile (refetch/invalidate).
 *
 * Errors are thrown as TRPCErrors, never returned in-band. The shape is a strict
 * additive superset of the legacy `{ success: true, stale?: boolean }` variants so
 * deployed clients keep working.
 */
export const mutationAckSchema = z.object({
  success: z.literal(true),
  applied: z.boolean(),
  stale: z.literal(true).optional(),
});

export type MutationAck = z.infer<typeof mutationAckSchema>;

export type MutationAckWith<T> = MutationAck & T;

export function appliedAck(): MutationAck;
export function appliedAck<T extends object>(extra: T): MutationAckWith<T>;
export function appliedAck<T extends object>(extra?: T): MutationAck | MutationAckWith<T> {
  return { success: true, applied: true, ...extra };
}

export function staleAck(): MutationAck;
export function staleAck<T extends object>(extra: T): MutationAckWith<T>;
export function staleAck<T extends object>(extra?: T): MutationAck | MutationAckWith<T> {
  return { success: true, applied: false, stale: true, ...extra };
}
