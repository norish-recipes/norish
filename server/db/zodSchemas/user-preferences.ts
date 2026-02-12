import z from "zod";

export const UserPreferencesSchema = z.object({
  timersEnabled: z.boolean().optional(),
  // Whether the ingredient list conversion button is visible
  showConversionButton: z.boolean().optional(),
});

export type UserPreferencesDto = z.infer<typeof UserPreferencesSchema>;
