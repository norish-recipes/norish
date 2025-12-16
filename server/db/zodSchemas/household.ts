import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { z } from "zod";

import { households, householdUsers } from "@/server/db/schema";

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
