// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { User } from "@norish/shared/contracts";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { db } from "@norish/db/drizzle";
import {
  createApiKey,
  disableApiKey,
  verifyApiKeyForRequest,
} from "@norish/db/repositories/api-keys";
import { listRecipes } from "@norish/db/repositories/recipes";
import { setConfig } from "@norish/db/repositories/server-config";
import * as schema from "@norish/db/schema";

import {
  createTestRecipe,
  createTestUser,
  getTestDb,
} from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

import "@norish/auth/auth";

const runDbTests = process.env.CI === "true" || process.env.MCP_DB_TEST === "1";

describe.skipIf(!runDbTests)("MCP repository boundaries", () => {
  const testBase = new RepositoryTestBase("test_mcp_boundaries");
  let user: User;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    [user] = await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await db
      .delete(schema.serverConfig)
      .where(eq(schema.serverConfig.key, ServerConfigKeys.RECIPE_PERMISSION_POLICY));
    await testBase.teardown();
  });

  it("verifies and then rejects a disabled API key through the real service", async () => {
    const { key, metadata } = await createApiKey(user.id, "mcp-integration");

    await expect(verifyApiKeyForRequest(key)).resolves.toEqual({
      status: "valid",
      userId: user.id,
    });

    await disableApiKey(metadata.id, user.id);

    await expect(verifyApiKeyForRequest(key)).resolves.toEqual({ status: "invalid" });
  });

  it("rejects an expired API key through the real service", async () => {
    const { key, metadata } = await createApiKey(user.id, "mcp-expired");

    await getTestDb()
      .update(schema.apiKeys)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(schema.apiKeys.id, metadata.id));

    await expect(verifyApiKeyForRequest(key)).resolves.toEqual({ status: "invalid" });
  });

  it("excludes a recipe the viewer cannot see from rows and total", async () => {
    const otherUser = await createTestUser();
    const foreignRecipe = await createTestRecipe(otherUser.id, { name: "Foreign recipe" });

    await setConfig(
      ServerConfigKeys.RECIPE_PERMISSION_POLICY,
      { view: "owner", edit: "owner", delete: "owner" },
      user.id,
      false
    );

    const result = await listRecipes(
      { userId: user.id, householdUserIds: null, isServerAdmin: false },
      50
    );

    expect(result.recipes.map((recipe) => recipe.id)).not.toContain(foreignRecipe.id);
    expect(result.total).toBe(1);
  });
});
