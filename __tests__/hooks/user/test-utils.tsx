import type { User } from "@/types";
import type { ApiKeyMetadataDto } from "@/server/trpc/routers/user/types";
import type { UserSettingsData } from "@/hooks/user/use-user-query";
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Create a test QueryClient with optimized settings for tests
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Create a wrapper component for testing hooks
 */
export function createTestWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/**
 * Create a mock user for testing
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "test-user-id",
    email: "test@example.com",
    name: "Test User",
    image: null,
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
  return { user, apiKeys, allergies };
}
