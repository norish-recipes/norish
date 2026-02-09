import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { siteAuthTokens } from "@/server/db/schema";

export const SiteAuthTokenSelectSchema = createSelectSchema(siteAuthTokens);

export const SiteAuthTokenInsertSchema = createInsertSchema(siteAuthTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Input for creating a token (before encryption)
export const CreateSiteAuthTokenInputSchema = z.object({
  domain: z
    .string()
    .min(1)
    .transform((v) => v.toLowerCase().trim()),
  name: z.string().min(1),
  value: z.string().min(1),
  type: z.enum(["header", "cookie"]),
});

// Input for updating a token
export const UpdateSiteAuthTokenInputSchema = z.object({
  id: z.uuid(),
  domain: z
    .string()
    .min(1)
    .transform((v) => v.toLowerCase().trim())
    .optional(),
  name: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
  type: z.enum(["header", "cookie"]).optional(),
});

// Input for deleting a token
export const DeleteSiteAuthTokenInputSchema = z.object({
  id: z.uuid(),
});

// Decrypted token for client display (value is never sent back)
export const SiteAuthTokenDecryptedSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  domain: z.string(),
  name: z.string(),
  value: z.string(),
  type: z.enum(["header", "cookie"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Token for client display (without value)
export const SiteAuthTokenSafeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  domain: z.string(),
  name: z.string(),
  type: z.enum(["header", "cookie"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});
