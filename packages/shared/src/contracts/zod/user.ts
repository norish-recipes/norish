import z from "zod";

import { DevicePreferencesSchema } from "./device-preferences";

/**
 * What happens once a recipe is planned: nothing, the groceries panel for it,
 * or its lines to buy straight onto the list. Absent means the panel.
 */
export const AFTER_PLANNING_CHOICES = ["nothing", "openGroceries", "addGroceries"] as const;

/**
 * The profile's preferences document: the person's own choices, which follow
 * them to every device, plus a block of Device Preferences per Device Kind.
 * Every choice is read on its own, so one this version does not know (a
 * broken block, an `afterPlanning` from a newer version) reads as absent and
 * never costs the reader the rest; a stored `hidden` key from before Hidden
 * Items moved per kind is ignored.
 */
export const UserPreferencesSchema = z.object({
  locale: z.string().nullable().optional().catch(undefined),
  afterPlanning: z.enum(AFTER_PLANNING_CHOICES).optional().catch(undefined),
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
  // Each person-level choice without its fallback, so a write rejects a value
  // outside its set; the device blocks are written by setDevicePreferences.
  preferences: z.object({
    locale: UserPreferencesSchema.shape.locale.unwrap(),
    afterPlanning: UserPreferencesSchema.shape.afterPlanning.unwrap(),
  }),
});

export const DeleteUserAvatarInputSchema = z.object({
  version: z.number().int().positive(),
});
