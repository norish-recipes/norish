import { TRPCError } from "@trpc/server";

/** A write made for another household than the caller is in now: applying it would land it there. */
export class OtherHouseholdWriteError extends Error {
  constructor() {
    super("Made for another household");
    this.name = "OtherHouseholdWriteError";
  }
}

/** Refuses a write naming a household other than `current`; one naming none is served. */
export function assertWriteHousehold(named: string | null | undefined, current: string): void {
  if (!named || named === current) return;

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Made for another household",
    cause: new OtherHouseholdWriteError(),
  });
}
