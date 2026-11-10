import type { UserSettingsData } from "@/hooks/user/use-user-query";

import type { User } from "@norish/shared/contracts";
import type { ApiKeyMetadataDto } from "@norish/trpc";

/**
 * Create a mock user for testing
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
    image: null,
    version: 1,
    isServerAdmin: false,
    ...overrides,
  };
}

/**
 * Create a mock API key for testing
 */
export function createMockApiKey(overrides: Partial<ApiKeyMetadataDto> = {}): ApiKeyMetadataDto {
  return {
    id: "test-api-key-id",
    name: "Test API Key",
    start: "sk-test",
    createdAt: new Date(),
    expiresAt: null,
    enabled: true,
    ...overrides,
  };
}

/**
 * Create mock user settings data
 */
export function createMockUserSettingsData(
  user: User = createMockUser(),
  apiKeys: ApiKeyMetadataDto[] = [],
  allergies: string[] = []
): UserSettingsData {
  return { user, apiKeys, allergies, allergiesVersion: 1 };
}
