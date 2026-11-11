import type { QueryClient } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";
import type {
  HouseholdAdminSettingsDto,
  HouseholdSettingsDto,
} from "@norish/shared/contracts/dto/household";
import { createTestWrapper, fakePlatformAdapter } from "@norish/shared-react/platform/testing";

import type { HouseholdData } from "../use-household";

/** The signed-in Reader the hooks' platform adapter names. */
export const READER: User = {
  id: "current-user",
  email: "test@example.com",
  name: "Test User",
  image: null,
  version: 1,
};

/** The query client and a platform adapter naming READER. */
export function readerWrapper(queryClient: QueryClient) {
  return createTestWrapper(queryClient, fakePlatformAdapter("phone", READER));
}

/**
 * Create mock household user data
 */
export function createMockHouseholdUser(
  overrides: Partial<{ id: string; name: string | null; isAdmin: boolean; version: number }> = {}
) {
  return {
    id: `user-${Math.random().toString(36).slice(2)}`,
    name: "Test User",
    isAdmin: false,
    version: 1,
    ...overrides,
  };
}

/**
 * Create mock household settings data (non-admin view)
 */
export function createMockHouseholdSettings(
  overrides: Partial<HouseholdSettingsDto> = {}
): HouseholdSettingsDto {
  return {
    id: `household-${Math.random().toString(36).slice(2)}`,
    name: "Test Household",
    version: 1,
    users: [createMockHouseholdUser({ isAdmin: true })],
    allergies: [],
    ...overrides,
  };
}

/**
 * Create mock household admin settings data (admin view with join code)
 */
export function createMockHouseholdAdminSettings(
  overrides: Partial<HouseholdAdminSettingsDto> = {}
): HouseholdAdminSettingsDto {
  return {
    id: `household-${Math.random().toString(36).slice(2)}`,
    name: "Test Household",
    version: 1,
    joinCode: "123456",
    joinCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    users: [createMockHouseholdUser({ isAdmin: true })],
    allergies: [],
    ...overrides,
  };
}

/**
 * Create mock household data response
 */
export function createMockHouseholdData(
  household: HouseholdSettingsDto | HouseholdAdminSettingsDto | null = null,
  currentUserId: string = "current-user-id"
): HouseholdData {
  return { household, currentUserId };
}

type Deferred = { resolve: (value: unknown) => void; reject: (error: unknown) => void };

/** Each write the account fake was sent, by procedure path; each waits until the test settles it. */
export const accountCalls: Record<string, { input: unknown; deferred: Deferred }[]> = {};

/** Reads that answer only when `answerRead` is called, by procedure path. */
const pendingReads: Record<string, ((data: unknown) => void)[]> = {};

export function answerRead(path: string, data: unknown) {
  for (const answer of pendingReads[path]?.splice(0) ?? []) answer(data);
}

export function resetAccountFake() {
  for (const name of Object.keys(accountCalls)) delete accountCalls[name];
  for (const name of Object.keys(pendingReads)) delete pendingReads[name];
}

function accountProcedure(path: string[]) {
  const name = path.join(".");
  const queryKey = (input?: unknown) =>
    input === undefined ? [path, { type: "query" }] : [path, { input, type: "query" }];

  return {
    queryKey,
    queryOptions: (input?: unknown, options?: object) => ({
      ...options,
      queryKey: queryKey(input),
      queryFn: () => new Promise((resolve) => (pendingReads[name] ??= []).push(resolve)),
    }),
    mutationOptions: (options: object = {}) => ({
      ...options,
      mutationKey: [path],
      mutationFn: (input: unknown) =>
        new Promise((resolve, reject) => {
          (accountCalls[name] ??= []).push({ input, deferred: { resolve, reject } });
        }),
    }),
  };
}

function accountNode(path: string[]): unknown {
  return new Proxy(accountProcedure(path), {
    get: (target, prop) =>
      typeof prop !== "string" || prop in target || prop === "then"
        ? Reflect.get(target, prop)
        : accountNode([...path, prop]),
  });
}

/** `../../trpc` for a `vi.mock`: every procedure by path, reads and writes the test settles. */
export function mockAccountTRPC() {
  const trpc = accountNode([]);

  return { useTRPC: () => trpc };
}

/** The key the real client gives a procedure's query with no input. */
export const keyOf = (path: string) => [path.split("."), { type: "query" }];
