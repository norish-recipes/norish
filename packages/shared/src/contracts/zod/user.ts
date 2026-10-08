import z from "zod";

import { DevicePreferencesSchema } from "./device-preferences";

/**
 * What happens once a recipe is planned: nothing, the groceries panel for it,
 * or its lines to buy straight onto the list. Absent means the panel.
 */
export const AFTER_PLANNING_CHOICES = ["nothing", "openGroceries", "addGroceries"] as const;

/** What follows the person to every device. */
export const PersonPreferencesSchema = z.object({
  locale: z.string().nullable().optional(),
  afterPlanning: z.enum(AFTER_PLANNING_CHOICES).optional(),
});

/**
 * The profile's preferences document: the person's own choices plus a block
 * of Device Preferences per Device Kind. A broken block reads as absent, so
 * it can never cost the reader their language, and a stored `hidden` key from
 * before Hidden Items moved per kind is ignored.
 */
export const UserPreferencesSchema = PersonPreferencesSchema.extend({
  phone: DevicePreferencesSchema.optional().catch(undefined),
  desktop: DevicePreferencesSchema.optional().catch(undefined),
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
  preferences: PersonPreferencesSchema.partial(),
});

export const DeleteUserAvatarInputSchema = z.object({
  version: z.number().int().positive(),
});
