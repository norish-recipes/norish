// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { hasKeptLink, keptNoLink } from "@norish/db/repositories/recipe-share-helpers";
import {
  createRecipeShare,
  deleteRecipeShare,
  getActiveRecipeShareByToken,
  getPublicRecipeView,
  getRecipeShareById,
  getRecipeShareByToken,
  getRecipeShareInventoryByUserId,
  getRecipeShareInventoryForAdmin,
  getRecipeSharesByUserId,
  getRecipeShareUrl,
  reactivateRecipeShare,
  revokeRecipeShare,
  updateRecipeShare,
} from "@norish/db/repositories/recipe-shares";
import { setConfig } from "@norish/db/repositories/server-config";
import * as schema from "@norish/db/schema";

import {
  createTestIngredient,
  createTestRecipe,
  createTestRecipeIngredients,
  createTestRecipeShare,
  createTestRecipeStep,
  createTestUser,
  getTestDb,
  joinTestHousehold,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("recipe share repository", () => {
  let testUserId: string;
  let testRecipeId: string;
  const testBase = new RepositoryTestBase("test_recipe_shares");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user, recipe] = await testBase.beforeEachTest();

    testUserId = user.id;
    testRecipeId = recipe.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("hashes tokens at rest and resolves shares by raw token", async () => {
    const created = await createRecipeShare(testUserId, {
      recipeId: testRecipeId,
      expiresIn: "1week",
    });

    const token = created.url.replace("/share/", "");
    const db = getTestDb();
    const [stored] = await db
      .select()
      .from(schema.recipeShares)
      .where(eq(schema.recipeShares.id, created.id));

    expect(stored).toBeDefined();
    expect(stored.tokenHash).not.toBe(token);

    const byToken = await getRecipeShareByToken(token);

    expect(byToken?.id).toBe(created.id);
    expect(created.status).toBe("active");
    expect(created.expiresAt).not.toBeNull();
  });

  it("keeps a new share's token encrypted and reads its link back", async () => {
    const created = await createRecipeShare(testUserId, {
      recipeId: testRecipeId,
      expiresIn: "forever",
    });
    const token = created.url.replace("/share/", "");
    const [stored] = await getTestDb()
      .select()
      .from(schema.recipeShares)
      .where(eq(schema.recipeShares.id, created.id));
    const fetched = await getRecipeShareById(created.id);

    expect(stored?.tokenEnc).toBeTruthy();
    expect(stored?.tokenEnc).not.toContain(token);
    expect(created.hasLink).toBe(true);
    expect(created).not.toHaveProperty("tokenEnc");
    expect(fetched && getRecipeShareUrl(fetched)).toBe(created.url);
  });

  it("has no link once a share is revoked or expired", async () => {
    const created = await createRecipeShare(testUserId, {
      recipeId: testRecipeId,
      expiresIn: "forever",
    });
    const fetched = await getRecipeShareById(created.id);

    expect(fetched).not.toBeNull();
    if (!fetched) return;
    expect(getRecipeShareUrl({ ...fetched, revokedAt: new Date() })).toBeNull();
    expect(getRecipeShareUrl({ ...fetched, expiresAt: new Date(Date.now() - 1000) })).toBeNull();
  });

  it("has no link when the kept token cannot be decrypted", async () => {
    const created = await createRecipeShare(testUserId, {
      recipeId: testRecipeId,
      expiresIn: "forever",
    });
    const fetched = await getRecipeShareById(created.id);

    expect(fetched).not.toBeNull();
    if (!fetched) return;
    expect(getRecipeShareUrl({ ...fetched, tokenEnc: "not-a-ciphertext" })).toBeNull();
  });

  it("tells the shares that kept no link alike in a query and on a row", async () => {
    const kept = await createRecipeShare(testUserId, {
      recipeId: testRecipeId,
      expiresIn: "forever",
    });
    const { share: none } = await createTestRecipeShare(testUserId, testRecipeId, { token: "a" });
    const { share: empty } = await createTestRecipeShare(testUserId, testRecipeId, { token: "b" });
    const db = getTestDb();

    await db
      .update(schema.recipeShares)
      .set({ tokenEnc: "" })
      .where(eq(schema.recipeShares.id, empty?.id ?? ""));
    const queried = await db
      .select({ id: schema.recipeShares.id })
      .from(schema.recipeShares)
      .where(keptNoLink);
    const rows = await db.select().from(schema.recipeShares);
    const linkless = [none?.id, empty?.id].sort();

    expect(queried.map(({ id }) => id).sort()).toEqual(linkless);
    expect(
      rows
        .filter((row) => !hasKeptLink(row))
        .map(({ id }) => id)
        .sort()
    ).toEqual(linkless);
    expect(kept.hasLink).toBe(true);
  });

  it("has no link for a share made before tokens were kept", async () => {
    const { share } = await createTestRecipeShare(testUserId, testRecipeId);
    const fetched = await getRecipeShareById(share.id);
    const [listed] = await getRecipeSharesByUserId(testUserId, testRecipeId);

    expect(fetched && getRecipeShareUrl(fetched)).toBeNull();
    expect(listed?.hasLink).toBe(false);
  });

  it("handles list, get, update, revoke, delete, and global list flows", async () => {
    const created = await createRecipeShare(testUserId, {
      recipeId: testRecipeId,
      expiresIn: "forever",
    });

    const listed = await getRecipeSharesByUserId(testUserId, testRecipeId);
    const fetched = await getRecipeShareById(created.id);

    expect(listed).toHaveLength(1);
    expect(fetched?.id).toBe(created.id);

    const updated = await updateRecipeShare({
      id: created.id,
      version: created.version,
      expiresIn: "1month",
    });

    expect(updated.stale).toBe(false);
    expect(updated.value?.version).toBe(created.version + 1);
    expect(updated.value?.expiresAt).not.toBeNull();

    const revoked = await revokeRecipeShare(created.id, updated.value!.version);

    expect(revoked.stale).toBe(false);
    expect(revoked.value?.status).toBe("revoked");
    expect(revoked.value?.revokedAt).not.toBeNull();

    const removed = await deleteRecipeShare(created.id, revoked.value!.version);

    expect(removed.stale).toBe(false);
    expect(await getRecipeShareById(created.id)).toBeNull();
  });

  it("rejects expired and revoked tokens uniformly and updates lastAccessedAt for active shares", async () => {
    const { share: activeShare, token: activeToken } = await createTestRecipeShare(
      testUserId,
      testRecipeId
    );
    const { token: expiredToken } = await createTestRecipeShare(testUserId, testRecipeId, {
      token: "expired-token",
      expiresAt: new Date(Date.now() - 60_000),
    });
    const { token: revokedToken } = await createTestRecipeShare(testUserId, testRecipeId, {
      token: "revoked-token",
      revokedAt: new Date(),
    });

    expect(await getActiveRecipeShareByToken("missing-token")).toBeNull();
    expect(await getActiveRecipeShareByToken(expiredToken)).toBeNull();
    expect(await getActiveRecipeShareByToken(revokedToken)).toBeNull();

    const resolved = await getActiveRecipeShareByToken(activeToken, { touchLastAccessedAt: true });

    expect(resolved?.id).toBe(activeShare.id);
    expect(resolved?.lastAccessedAt).not.toBeNull();
  });

  it("builds a sanitized public recipe view with share-scoped media URLs", async () => {
    const db = getTestDb();
    const { token } = await createTestRecipeShare(testUserId, testRecipeId, {
      token: "public-token",
    });
    const ingredient = await createTestIngredient({ name: "Flour" });
    const step = await createTestRecipeStep(testRecipeId, "metric", {
      step: "Add toppings",
      order: "0",
    });

    await createTestRecipeIngredients(testRecipeId, ingredient.id, "metric", {
      amount: "200",
      unit: "g",
      order: "0",
    });

    await db.insert(schema.recipeImages).values({
      recipeId: testRecipeId,
      image: `/recipes/${testRecipeId}/gallery.jpg`,
      order: "0",
    });
    await db.insert(schema.recipeVideos).values({
      recipeId: testRecipeId,
      video: `/recipes/${testRecipeId}/demo.mp4`,
      thumbnail: `/recipes/${testRecipeId}/demo-thumb.jpg`,
      duration: "42",
      order: "0",
    });
    await db.insert(schema.stepImages).values({
      stepId: step.id,
      image: `/recipes/${testRecipeId}/steps/step.jpg`,
      order: "0",
    });

    const publicRecipe = await getPublicRecipeView(testRecipeId, token, async () => new Map());

    expect(publicRecipe).not.toBeNull();
    expect(publicRecipe).not.toHaveProperty("id");
    expect(publicRecipe).not.toHaveProperty("userId");
    expect(publicRecipe).not.toHaveProperty("image");
    expect(publicRecipe?.images[0]?.image).toBe(`/share/${token}/media/gallery.jpg`);
    expect(publicRecipe?.videos[0]?.video).toBe(`/share/${token}/media/demo.mp4`);
    expect(publicRecipe?.videos[0]?.thumbnail).toBe(`/share/${token}/media/demo-thumb.jpg`);
    expect(publicRecipe?.steps[0]?.images[0]?.image).toBe(`/share/${token}/steps/step.jpg`);
    expect(publicRecipe?.recipeIngredients[0]).not.toHaveProperty("ingredientId");
    expect(publicRecipe?.steps[0]).not.toHaveProperty("version");
  });

  it("carries Step Ingredients into the public view without exposing any ids", async () => {
    const db = getTestDb();
    const { token } = await createTestRecipeShare(testUserId, testRecipeId, {
      token: "step-ingredients-token",
    });
    const ingredient = await createTestIngredient({ name: "Water" });
    const step = await createTestRecipeStep(testRecipeId, "metric", {
      step: "Add half the water",
      order: "0",
    });
    const line = await createTestRecipeIngredients(testRecipeId, ingredient.id, "metric", {
      amount: "50",
      unit: "ml",
      order: "0",
    });

    await db.insert(schema.stepIngredients).values({
      stepId: step.id,
      recipeIngredientId: line.id,
      share: "0.5",
      order: "0",
    });

    const publicRecipe = await getPublicRecipeView(testRecipeId, token, async () => new Map());

    // The reference resolves by line order within the system — the recipient
    // derives 25 ml at display time, and no row id crosses the boundary.
    expect(publicRecipe?.steps[0]?.stepIngredients).toEqual([
      { ingredientOrder: 0, share: 0.5, order: 0 },
    ]);
    expect(publicRecipe?.steps[0]?.stepIngredients[0]).not.toHaveProperty("id");
    expect(publicRecipe?.steps[0]?.stepIngredients[0]).not.toHaveProperty("recipeIngredientId");
  });

  it("is inactive while its maker may not view the recipe, and works again after", async () => {
    const setView = (view: "everyone" | "household") =>
      setConfig(
        ServerConfigKeys.RECIPE_PERMISSION_POLICY,
        { view, edit: "household", delete: "household" },
        null,
        false
      );
    const other = await createTestRecipe((await createTestUser()).id, { name: "Their soup" });

    await setView("everyone");
    const created = await createRecipeShare(testUserId, {
      recipeId: other.id,
      expiresIn: "forever",
    });
    const token = created.url.replace("/share/", "");

    expect(await getActiveRecipeShareByToken(token)).not.toBeNull();
    expect((await getRecipeShareInventoryByUserId(testUserId)).map((s) => s.recipeName)).toEqual([
      "Their soup",
    ]);

    await setView("household");
    expect(await getActiveRecipeShareByToken(token)).toBeNull();
    expect(await getRecipeShareInventoryByUserId(testUserId)).toEqual([]);
    expect(await getRecipeShareById(created.id)).not.toBeNull();

    await setView("everyone");
    expect((await getActiveRecipeShareByToken(token))?.id).toBe(created.id);
  });

  it("lists every household's links for an admin, inactive ones marked, and revokes across households", async () => {
    await setConfig(
      ServerConfigKeys.RECIPE_PERMISSION_POLICY,
      { view: "everyone", edit: "household", delete: "household" },
      null,
      false
    );
    // The admin and the test user are household A; Bob is household B.
    const admin = (await createTestUser({ name: "Admin", isServerAdmin: true })).id;
    const bob = (await createTestUser({ name: "Bob" })).id;

    await joinTestHousehold(admin, testUserId);
    const stew = await createTestRecipe(bob, { name: "Stew" });
    const bobs = await createRecipeShare(bob, { recipeId: stew.id, expiresIn: "forever" });
    const crossed = await createRecipeShare(testUserId, {
      recipeId: stew.id,
      expiresIn: "forever",
    });

    await setConfig(
      ServerConfigKeys.RECIPE_PERMISSION_POLICY,
      { view: "household", edit: "household", delete: "household" },
      null,
      false
    );
    const listed = await getRecipeShareInventoryForAdmin();

    expect(Object.keys(listed[0]!).sort()).toEqual([
      "createdAt",
      "expiresAt",
      "hasLink",
      "id",
      "lastAccessedAt",
      "makerMayView",
      "ownerId",
      "ownerName",
      "recipeId",
      "recipeName",
      "revokedAt",
      "status",
      "updatedAt",
      "userId",
      "version",
    ]);
    expect(listed.map((s) => [s.id, s.recipeName, s.ownerName, s.status, s.makerMayView])).toEqual([
      [crossed.id, "Stew", "Test User", "active", false],
      [bobs.id, "Stew", "Bob", "active", true],
    ]);
    // The maker's own view and the public page still treat the crossed link as inactive.
    expect(await getRecipeShareInventoryByUserId(testUserId)).toEqual([]);
    expect(await getActiveRecipeShareByToken(crossed.url.replace("/share/", ""))).toBeNull();

    const revoked = await revokeRecipeShare(bobs.id, bobs.version);

    expect(revoked.value?.status).toBe("revoked");
    expect((await getRecipeShareInventoryForAdmin()).find((s) => s.id === bobs.id)?.status).toBe(
      "revoked"
    );
    expect(await getActiveRecipeShareByToken(bobs.url.replace("/share/", ""))).toBeNull();

    // An admin reactivating the crossed link leaves it inactive on the public page.
    const crossedToken = crossed.url.replace("/share/", "");
    const off = await revokeRecipeShare(crossed.id, crossed.version);
    const on = await reactivateRecipeShare(crossed.id, off.value!.version);

    expect(on.value?.status).toBe("active");
    expect(await getActiveRecipeShareByToken(crossedToken)).toBeNull();
  });
});
