import { JoinCodeSchema } from "@norish/shared/lib/validation/schemas";

/** A join code is exactly six digits; the server strips anything else, so Join waits for these. */
export const isJoinCode = (code: string) => JoinCodeSchema.safeParse(code).success;
