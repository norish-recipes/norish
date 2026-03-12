/**
 * Mock for connection tests
 */
import { vi } from "vitest";

export const testOIDCProvider = vi.fn();
export const testGitHubProvider = vi.fn();
export const testGoogleProvider = vi.fn();
export const testAIEndpoint = vi.fn();

export function resetConnectionTestMocks() {
  testOIDCProvider.mockReset();
  testGitHubProvider.mockReset();
  testGoogleProvider.mockReset();
  testAIEndpoint.mockReset();
}
