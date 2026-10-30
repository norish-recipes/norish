// @vitest-environment node
/** The 0.26 boot upgrade clears the sign-in tokens older releases stored, and nothing else. */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { clearStoredOAuthTokens } from "@norish/db/repositories/upgrades";
import { accounts } from "@norish/db/schema";

import { createTestUser, getTestDb } from "../helpers/db-test-helpers";
import { RepositoryTestBase } from "../helpers/repository-test-base";

const testBase = new RepositoryTestBase("upgrades_oauth_tokens");

beforeAll(async () => await testBase.setup());
afterAll(async () => await testBase.teardown());
beforeEach(async () => await testBase.beforeEachTest());

describe("clearing stored sign-in tokens", () => {
  it("empties every token and keeps the account, its password and its scope", async () => {
    const db = getTestDb();
    const { id: userId } = await createTestUser();

    await db.insert(accounts).values([
      {
        userId,
        providerId: "oidc",
        accountId: "ada-sub",
        accessToken: "access",
        refreshToken: "refresh",
        idToken: "id",
        scope: "openid email profile",
      },
      { userId, providerId: "credential", accountId: userId, password: "hashed" },
    ]);

    expect(await clearStoredOAuthTokens()).toBe(1);
    expect(await clearStoredOAuthTokens()).toBe(0);

    const [oidc] = await db.select().from(accounts).where(eq(accounts.providerId, "oidc"));
    const [credential] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.providerId, "credential"));

    expect(oidc).toMatchObject({
      accountId: "ada-sub",
      accessToken: null,
      refreshToken: null,
      idToken: null,
      scope: "openid email profile",
    });
    expect(credential?.password).toBe("hashed");
  });
});
