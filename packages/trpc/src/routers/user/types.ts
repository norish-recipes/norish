import { z } from "zod";

import {
  UpdateUserNameInputSchema,
  UpdateUserPreferencesInputSchema,
  UserDtoSchema,
} from "@norish/shared/contracts/zod";

// API Key metadata schema (matches ApiKeyMetadata type)
export const ApiKeyMetadataSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  start: z.string().nullable(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable(),
  enabled: z.boolean().nullable(),
});

export type ApiKeyMetadataDto = z.infer<typeof ApiKeyMetadataSchema>;

// User settings response (user + api keys)
export const UserSettingsSchema = z.object({
  user: UserDtoSchema,
  apiKeys: z.array(ApiKeyMetadataSchema),
});

export type UserSettingsDto = z.infer<typeof UserSettingsSchema>;

// Input schemas
export const UpdateNameInputSchema = UpdateUserNameInputSchema;

export const CreateApiKeyInputSchema = z.object({
  name: z.string().optional(),
});

export const DeleteApiKeyInputSchema = z.object({
  keyId: z.string().min(1),
});

export const ToggleApiKeyInputSchema = z.object({
  keyId: z.string().min(1),
  enabled: z.boolean(),
});

// Preferences
export const UpdatePreferencesInputSchema = UpdateUserPreferencesInputSchema;
