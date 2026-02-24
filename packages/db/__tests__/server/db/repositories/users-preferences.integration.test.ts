// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getUserPreferences, updateUserPreferences } from "@norish/db/repositories/users";
import { users } from "@norish/db/schema";

import { getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("User preferences - DB integration", () => {
  const testBase = new RepositoryTestBase("user_preferences_integration");
  let userId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("writes a simple preference key into the preferences JSONB column", async () => {
    await updateUserPreferences(userId, { timersEnabled: false });

    const db = getTestDb();

    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { preferences: true },
    });

    expect(row).toBeDefined();
    expect(row!.preferences).toBeDefined();
    expect((row!.preferences as any).timersEnabled).toBe(false);
  });

  it("merges subsequent updates into the existing preferences object", async () => {
    // initial update
    await updateUserPreferences(userId, { a: 1 });

    // second update should merge, not replace
    await updateUserPreferences(userId, { b: 2 });

    const db = getTestDb();

    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { preferences: true },
    });

    expect(row).toBeDefined();
    const prefs = row!.preferences as Record<string, unknown>;

    expect(prefs.a).toBe(1);
    expect(prefs.b).toBe(2);
  });

  it("getUserPreferences returns an object reflecting the stored JSONB", async () => {
    await updateUserPreferences(userId, { showConversionButton: true });

    const prefs = await getUserPreferences(userId);

    expect(prefs).toBeDefined();
    expect((prefs as any).showConversionButton).toBe(true);
  });

  it("stores and retrieves locale in JSONB preferences", async () => {
    await updateUserPreferences(userId, { locale: "de-informal" });

    const prefs = await getUserPreferences(userId);

    expect(prefs).toBeDefined();
    expect((prefs as any).locale).toBe("de-informal");
  });

  it("updates locale without affecting other preferences", async () => {
    await updateUserPreferences(userId, { timersEnabled: true, locale: "en" });
    await updateUserPreferences(userId, { locale: "fr" });

    const prefs = await getUserPreferences(userId);

    expect((prefs as any).timersEnabled).toBe(true);
    expect((prefs as any).locale).toBe("fr");
  });
});
