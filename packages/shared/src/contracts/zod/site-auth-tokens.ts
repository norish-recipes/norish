import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { siteAuthTokens } from "@norish/db-schema/schema";

export const SiteAuthTokenSelectSchema = createSelectSchema(siteAuthTokens);

export const SiteAuthTokenInsertSchema = createInsertSchema(siteAuthTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/** A full domain such as `instagram.com`, which also covers its subdomains. */
export const TokenDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .includes(".", { error: "Enter the full domain, such as instagram.com." });

// Input for creating a token (before encryption)
export const CreateSiteAuthTokenInputSchema = z.object({
  domain: TokenDomainSchema,
  // Blank and absent both mean "not tied to one account".
  account: z
    .string()
    .trim()
    .nullish()
    .transform((v) => v || null),
  name: z.string().min(1),
  value: z.string().min(1),
  type: z.enum(["header", "cookie"]),
});

// Input for updating a token
export const UpdateSiteAuthTokenInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
  domain: TokenDomainSchema.optional(),
  account: z.string().trim().nullable().optional(),
  name: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
  type: z.enum(["header", "cookie"]).optional(),
});

// Input for deleting a token
export const DeleteSiteAuthTokenInputSchema = z.object({
  id: z.uuid(),
  version: z.number().int().positive(),
});

// Decrypted token for client display (value is never sent back)
export const SiteAuthTokenDecryptedSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  domain: z.string(),
  account: z.string().nullable(),
  name: z.string(),
  value: z.string(),
  type: z.enum(["header", "cookie"]),
  version: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Token for client display (without value)
export const SiteAuthTokenSafeSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  domain: z.string(),
  account: z.string().nullable(),
  name: z.string(),
  type: z.enum(["header", "cookie"]),
  version: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
