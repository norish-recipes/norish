// @vitest-environment node
/**
 * Every Sign-in Method leaves a new account in a household of one, which it
 * administers. The real auth config runs against Postgres, so the account and its
 * household are made in the transaction Better Auth creates the user in.
 */
import { handleOAuthUserInfo } from "better-auth/oauth2";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getHouseholdForUser } from "@norish/db/repositories/households";
import { getUserRoleFlags } from "@norish/db/repositories/users";

import { cleanDatabase } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

const { valkey } = vi.hoisted(() => ({ valkey: new Map<string, string>() }));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isRegistrationEnabled: vi.fn().mockResolvedValue(true),
}));
vi.mock("@norish/auth/claim-processor", () => ({
  getPendingOIDCProfile: vi.fn(),
  mergeOIDCTokenClaims: vi.fn(),
  processClaimsForUser: vi.fn(),
  storeOIDCProfile: vi.fn(),
}));
vi.mock("@norish/shared-server/logger", () => {
  const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };

  return { authLogger: logger, dbLogger: logger, createLogger: () => logger };
});
vi.mock("@norish/shared-server/valkey/client", () => ({
  getPublisherClient: async () => ({
    get: async (key: string) => valkey.get(key) ?? null,
    set: async (key: string, value: string) => valkey.set(key, value),
    setex: async (key: string, _ttl: number, value: string) => valkey.set(key, value),
    del: async (key: string) => valkey.delete(key),
  }),
}));

type AuthModule = typeof import("@norish/auth/auth");

const testBase = new RepositoryTestBase("test_sign_up_household");
let authModule: AuthModule;

async function expectHouseholdOfOne(userId: string) {
  const household = await getHouseholdForUser(userId);

  expect(household).toMatchObject({ adminUserId: userId });
  expect(household!.users.map((member) => member.id)).toEqual([userId]);
}

async function signInWith(providerId: string, accountId: string, email: string) {
  const result = await handleOAuthUserInfo(
    { context: await authModule.auth.$context } as unknown as Parameters<
      typeof handleOAuthUserInfo
    >[0],
    {
      userInfo: { id: accountId, email, emailVerified: true, name: "Ada" },
      account: { providerId, accountId },
    }
  );

  expect(result.error).toBeNull();

  return result.data!.user.id;
}

async function signUpWithPassword(email: string) {
  const { user } = await authModule.auth.api.signUpEmail({
    body: { email, password: "ada-password-1", name: "Ada" },
  });

  return user.id;
}

beforeAll(async () => {
  await testBase.setup();

  const { setAuthProviderCache } = await import("@norish/auth/provider-cache");

  setAuthProviderCache({
    github: { clientId: "github-id", clientSecret: "github-secret", isOverridden: false },
    google: { clientId: "google-id", clientSecret: "google-secret", isOverridden: false },
    oidc: null,
    passwordEnabled: true,
  });
  authModule = await import("@norish/auth/auth");
}, 180_000);

beforeEach(async () => {
  valkey.clear();
  await cleanDatabase();
});

afterAll(async () => {
  await testBase.teardown();
});

describe("a new account's household", () => {
  it("is made for the first account, which becomes the server owner", async () => {
    const userId = await signUpWithPassword("owner@norish.test");

    expect(await getUserRoleFlags(userId)).toEqual({ isServerOwner: true, isServerAdmin: true });
    await expectHouseholdOfOne(userId);
  });

  it("is made for a password sign-up", async () => {
    await signUpWithPassword("owner@norish.test");

    await expectHouseholdOfOne(await signUpWithPassword("ada@norish.test"));
  });

  it.each(["github", "google", "oidc"])("is made for a first %s sign-in", async (providerId) => {
    await signUpWithPassword("owner@norish.test");

    await expectHouseholdOfOne(
      await signInWith(providerId, `${providerId}-1`, `${providerId}@norish.test`)
    );
  });

  it("is not made again when a returning account signs in", async () => {
    await signUpWithPassword("owner@norish.test");

    const userId = await signInWith("github", "github-1", "ada@norish.test");
    const household = await getHouseholdForUser(userId);

    expect(await signInWith("github", "github-1", "ada@norish.test")).toBe(userId);
    expect((await getHouseholdForUser(userId))?.id).toBe(household?.id);
  });
});
