// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  getUserPreferences,
  setUserDevicePreferences,
  updateUserPreferences,
} from "@norish/db/repositories/users";
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

  it("writes a list-valued preference key into the preferences JSONB column", async () => {
    await updateUserPreferences(userId, { someList: ["one"] });

    const db = getTestDb();

    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { preferences: true },
    });

    expect(row).toBeDefined();
    expect(row!.preferences).toBeDefined();
    expect((row!.preferences as any).someList).toEqual(["one"]);
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
    await updateUserPreferences(userId, { someList: ["one", "two"] });

    const prefs = await getUserPreferences(userId);

    expect(prefs).toBeDefined();
    expect((prefs as any).someList).toEqual(["one", "two"]);
  });

  it("stores and retrieves locale in JSONB preferences", async () => {
    await updateUserPreferences(userId, { locale: "de-informal" });

    const prefs = await getUserPreferences(userId);

    expect(prefs).toBeDefined();
    expect((prefs as any).locale).toBe("de-informal");
  });

  it("updates locale without affecting other preferences", async () => {
    await updateUserPreferences(userId, { someList: [], locale: "en" });
    await updateUserPreferences(userId, { locale: "fr" });

    const prefs = await getUserPreferences(userId);

    expect((prefs as any).someList).toEqual([]);
    expect((prefs as any).locale).toBe("fr");
  });

  async function readRow() {
    const row = await getTestDb().query.users.findFirst({
      where: eq(users.id, userId),
      columns: { preferences: true, version: true },
    });

    return row!;
  }

  it("merges a Device Preference into its kind's block, per choice", async () => {
    await setUserDevicePreferences(userId, "phone", { groceryViewMode: "recipe" });
    await setUserDevicePreferences(userId, "phone", { groceryGroupSimilar: false });

    const { preferences } = await readRow();

    expect(preferences).toEqual({
      phone: { groceryViewMode: "recipe", groceryGroupSimilar: false },
    });
  });

  it("leaves the other kind, the language and after-planning untouched", async () => {
    await updateUserPreferences(userId, { locale: "nl", afterPlanning: "nothing" });
    await setUserDevicePreferences(userId, "desktop", { groceryViewMode: "store" });
    await setUserDevicePreferences(userId, "phone", { groceryViewMode: "recipe" });

    const { preferences } = await readRow();

    expect(preferences).toEqual({
      locale: "nl",
      afterPlanning: "nothing",
      desktop: { groceryViewMode: "store" },
      phone: { groceryViewMode: "recipe" },
    });
  });

  it("never goes through the profile's version, so it neither goes stale nor makes others stale", async () => {
    const before = (await readRow()).version;

    await setUserDevicePreferences(userId, "phone", { groceryViewMode: "recipe" });

    expect((await readRow()).version).toBe(before);
  });

  it("a language update leaves Device Preferences untouched", async () => {
    await setUserDevicePreferences(userId, "phone", { groceryViewMode: "recipe" });
    await updateUserPreferences(userId, { locale: "fr" });

    expect((await readRow()).preferences).toEqual({
      locale: "fr",
      phone: { groceryViewMode: "recipe" },
    });
  });

  it("replaying the same write is harmless", async () => {
    await setUserDevicePreferences(userId, "phone", { groceryViewMode: "recipe" });
    const once = (await readRow()).preferences;

    await setUserDevicePreferences(userId, "phone", { groceryViewMode: "recipe" });

    expect((await readRow()).preferences).toEqual(once);
  });

  it("starts a fresh block over a broken one", async () => {
    await updateUserPreferences(userId, { phone: "broken" });
    await setUserDevicePreferences(userId, "phone", { groceryViewMode: "recipe" });

    expect((await readRow()).preferences).toEqual({ phone: { groceryViewMode: "recipe" } });
  });
});
