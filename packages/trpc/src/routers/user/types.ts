import { z } from "zod";

import type { User, UserPreferences } from "@norish/shared/contracts";
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
export type UserSettingsDto = {
  user: User;
  apiKeys: ApiKeyMetadataDto[];
};

type UpdateNameInput = {
  name: string;
  version: number;
};

type UpdatePreferencesInput = {
  version: number;
  preferences: Partial<UserPreferences>;
};

// User settings response (user + api keys)
export const UserSettingsSchema: z.ZodType<UserSettingsDto> = z.object({
  user: UserDtoSchema,
  apiKeys: z.array(ApiKeyMetadataSchema),
});

// Input schemas
export const UpdateNameInputSchema: z.ZodType<UpdateNameInput, UpdateNameInput> =
  UpdateUserNameInputSchema;

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
export const UpdatePreferencesInputSchema: z.ZodType<
  UpdatePreferencesInput,
  UpdatePreferencesInput
> = UpdateUserPreferencesInputSchema;
