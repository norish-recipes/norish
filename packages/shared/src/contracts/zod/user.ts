import z from "zod";

/**
 * The things a reader can choose not to be shown. Names only — what each one
 * suppresses is the reading side's business, not the contract's.
 *
 * `timers` differs from the rest in one way: an administrator can switch recipe
 * timers off for the whole deployment, and when they have, a reader is never
 * offered the choice. The stored name survives that, so turning the capability
 * back on restores whatever the reader had chosen.
 */
export const HIDDEN_ITEMS = [
  "provenance",
  "nutrition",
  "notes",
  "rating",
  "favorites",
  "conversion",
  "timers",
] as const;

export type HiddenItem = (typeof HIDDEN_ITEMS)[number];

export const UserPreferencesSchema = z.object({
  /**
   * What this reader has hidden. Absent or empty means everything is shown,
   * which is the default. Stored as plain strings rather than an enum so an
   * entry this version does not recognise is simply ignored: a future hideable
   * item costs nothing here, and an older client cannot lose one it never knew.
   */
  hidden: z.array(z.string()).optional(),
  locale: z.string().nullable().optional(),
});

export type UserPreferencesDto = z.infer<typeof UserPreferencesSchema>;

// Not using createSelectSchema as we use encrypted fields and want to expose only decrypted ones
// Placed in db zod schemas as this is related to the user table and for ease of finding.
export const UserDtoSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  image: z.string().nullable().optional(),
  version: z.number().int().positive(),
  isServerAdmin: z.boolean().optional(),
  preferences: UserPreferencesSchema.optional(),
});

export const UpdateUserNameInputSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(100, "Name too long"),
  version: z.number().int().positive(),
});

export const UpdateUserPreferencesInputSchema = z.object({
  version: z.number().int().positive(),
  preferences: UserPreferencesSchema.partial(),
});

export const DeleteUserAvatarInputSchema = z.object({
  version: z.number().int().positive(),
});
