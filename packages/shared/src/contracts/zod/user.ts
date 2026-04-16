import z from "zod";

export const UserPreferencesSchema = z.object({
  timersEnabled: z.boolean().optional(),
  showConversionButton: z.boolean().optional(),
  showRatings: z.boolean().optional(),
  showFavorites: z.boolean().optional(),
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
