import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { households, householdUsers } from "@norish/db/schema";

export const HouseholdSelectBaseSchema = createSelectSchema(households);
export const HouseholdInsertBaseSchema = createInsertSchema(households).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  joinCode: true,
  joinCodeExpiresAt: true,
});
export const HouseholdUpdateBaseSchema = createUpdateSchema(households).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  joinCode: true,
  joinCodeExpiresAt: true,
});

export const HouseholdUserSelectBaseSchema = createSelectSchema(householdUsers);
export const HouseholdUserInsertBaseSchema = createInsertSchema(householdUsers).omit({
  createdAt: true,
});

export const HouseholdUserSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  isAdmin: z.boolean().optional(),
  version: z.number(),
});

export const HouseholdEventUserSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  isAdmin: z.boolean(),
  version: z.number().int().positive(),
});

export const HouseholdWithUsersNamesSchema = HouseholdSelectBaseSchema.extend({
  users: z.array(HouseholdUserSchema).default([]),
});

// Schema for household settings view - omits sensitive fields and unused timestamp fields
// Users can determine admin from the isAdmin flag in the users array
export const HouseholdSettingsSchema = HouseholdSelectBaseSchema.omit({
  adminUserId: true,
  createdAt: true,
  updatedAt: true,
  joinCode: true,
  joinCodeExpiresAt: true,
}).extend({
  users: z.array(HouseholdUserSchema).default([]),
  allergies: z.array(z.string()).default([]),
});

// Schema for admin household settings view - includes joinCode and expiration
export const HouseholdAdminSettingsSchema = HouseholdSelectBaseSchema.omit({
  adminUserId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  users: z.array(HouseholdUserSchema).default([]),
  allergies: z.array(z.string()).default([]),
});

export const LeaveHouseholdInputSchema = z.object({
  householdId: z.string().uuid(),
  version: z.number().int().positive(),
});

export const KickHouseholdUserInputSchema = z.object({
  householdId: z.string().uuid(),
  userId: z.string(),
  version: z.number().int().positive(),
});

export const RegenerateHouseholdJoinCodeInputSchema = z.object({
  householdId: z.string().uuid(),
  version: z.number().int().positive(),
});

export const TransferHouseholdAdminInputSchema = z.object({
  householdId: z.string().uuid(),
  newAdminId: z.string(),
  version: z.number().int().positive(),
});

export const HouseholdUserJoinedEventSchema = z.object({
  user: HouseholdEventUserSchema,
});

export const HouseholdUserLeftEventSchema = z.object({
  userId: z.string(),
});

export const HouseholdUserKickedEventSchema = z.object({
  householdId: z.string(),
  kickedBy: z.string(),
});

export const HouseholdMemberRemovedEventSchema = z.object({
  userId: z.string(),
});

export const HouseholdAdminTransferredEventSchema = z.object({
  oldAdminId: z.string(),
  newAdminId: z.string(),
  version: z.number().int().positive(),
});

export const HouseholdJoinCodeRegeneratedEventSchema = z.object({
  joinCode: z.string(),
  joinCodeExpiresAt: z.string(),
  version: z.number().int().positive(),
});

export const HouseholdAllergiesUpdatedEventSchema = z.object({
  allergies: z.array(z.string()),
});

export const HouseholdFailedEventSchema = z.object({
  reason: z.string(),
});
