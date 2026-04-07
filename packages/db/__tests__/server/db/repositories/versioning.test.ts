// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  addRecipeImages,
  addRecipeVideos,
  addUserToHousehold,
  createHousehold,
  createTag,
  getHouseholdForUser,
  getRecipeFull,
  getUserAllergies,
  getUserById,
  updateRecipeImageOrder,
  updateRecipeVideoOrder,
  updateTagName,
  updateUserAllergies,
  updateUserName,
} from "@norish/db";
import {
  recipeImages,
  recipeVideos,
  stepImages,
  tags,
  userAllergies,
  users,
} from "@norish/db/schema";

import {
  createTestIngredient,
  createTestRecipeIngredients,
  createTestRecipeStep,
  createTestUser,
  getTestDb,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("versioned repository behavior", () => {
  const testBase = new RepositoryTestBase("test_versioning");

  let testUserId: string;
  let testRecipeId: string;

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

  it("starts tags at version 1 and increments on rename", async () => {
    const tag = await createTag("Pantry");

    expect(tag.version).toBe(1);

    await updateTagName("Pantry", "Pantry Staples");

    const db = getTestDb();
    const [updatedTag] = await db.select().from(tags).where(eq(tags.id, tag.id)).limit(1);

    expect(updatedTag).toMatchObject({
      id: tag.id,
      name: "Pantry Staples",
      version: 2,
    });
  });

  it("starts household memberships at version 1 and exposes them in the household DTO", async () => {
    const joiningUser = await createTestUser();
    const household = await createHousehold({
      name: "Versioned Household",
      adminUserId: testUserId,
    });

    const membership = await addUserToHousehold({
      householdId: household.id,
      userId: joiningUser.id,
    });

    expect(membership.version).toBe(1);

    const householdDto = await getHouseholdForUser(joiningUser.id);

    expect(householdDto?.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: joiningUser.id,
          version: 1,
        }),
      ])
    );
  });

  it("starts nested recipe entities at version 1 and increments media versions on reorder", async () => {
    const ingredient = await createTestIngredient({ name: "Flour" });
    const recipeIngredient = await createTestRecipeIngredients(
      testRecipeId,
      ingredient.id,
      "metric",
      {
        amount: "250",
        unit: "g",
        order: "0",
      }
    );
    const step = await createTestRecipeStep(testRecipeId, "metric", {
      step: "Mix ingredients",
      order: "0",
    });
    const db = getTestDb();
    const [stepImage] = await db
      .insert(stepImages)
      .values({ stepId: step.id, image: "/step.jpg", order: "0" })
      .returning();
    const [image] = await addRecipeImages(testRecipeId, [{ image: "/hero.jpg", order: 0 }]);
    const [video] = await addRecipeVideos(testRecipeId, [
      { video: "/clip.mp4", thumbnail: null, duration: 12, order: 0 },
    ]);

    expect(recipeIngredient.version).toBe(1);
    expect(step.version).toBe(1);
    expect(stepImage?.version).toBe(1);
    expect(image?.version).toBe(1);
    expect(video?.version).toBe(1);

    await updateRecipeImageOrder(image!.id, 2);
    await updateRecipeVideoOrder(video!.id, 3);

    const [updatedImage] = await db
      .select()
      .from(recipeImages)
      .where(eq(recipeImages.id, image!.id))
      .limit(1);
    const [updatedVideo] = await db
      .select()
      .from(recipeVideos)
      .where(eq(recipeVideos.id, video!.id))
      .limit(1);
    const fullRecipe = await getRecipeFull(testRecipeId);

    expect(updatedImage).toMatchObject({ version: 2, order: "2" });
    expect(updatedVideo).toMatchObject({ version: 2, order: "3" });
    expect(fullRecipe?.recipeIngredients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: recipeIngredient.id,
          version: 1,
        }),
      ])
    );
    expect(fullRecipe?.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          step: "Mix ingredients",
          version: 1,
          images: expect.arrayContaining([
            expect.objectContaining({
              image: "/step.jpg",
              version: 1,
            }),
          ]),
        }),
      ])
    );
    expect(fullRecipe?.images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: image!.id,
          version: 2,
        }),
      ])
    );
    expect(fullRecipe?.videos).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: video!.id,
          version: 2,
        }),
      ])
    );
  });

  it("starts users at version 1 and increments on profile updates", async () => {
    const db = getTestDb();
    const [initialUser] = await db.select().from(users).where(eq(users.id, testUserId)).limit(1);

    expect(initialUser?.version).toBe(1);

    await updateUserName(testUserId, "Updated Test User");

    const updatedUser = await getUserById(testUserId);

    expect(updatedUser).toMatchObject({
      id: testUserId,
      name: "Updated Test User",
      version: 2,
    });
  });

  it("keeps allergy versions monotonic, including empty allergy sets", async () => {
    await updateUserAllergies(testUserId, ["Peanuts"], 0);

    const firstRead = await getUserAllergies(testUserId);

    expect(firstRead).toEqual({
      allergies: ["Peanuts"],
      version: 2,
    });

    await updateUserAllergies(testUserId, [], firstRead.version);

    const secondRead = await getUserAllergies(testUserId);

    expect(secondRead).toEqual({
      allergies: [],
      version: 3,
    });

    await updateUserAllergies(testUserId, ["Peanuts", "Shellfish"], secondRead.version);

    const thirdRead = await getUserAllergies(testUserId);
    const db = getTestDb();
    const rows = await db
      .select({ version: userAllergies.version })
      .from(userAllergies)
      .where(eq(userAllergies.userId, testUserId));

    expect(thirdRead).toEqual({
      allergies: ["Peanuts", "Shellfish"],
      version: 4,
    });
    expect(rows).toEqual([
      expect.objectContaining({ version: 4 }),
      expect.objectContaining({ version: 4 }),
    ]);
  });

  it("treats stale allergy updates as no-ops", async () => {
    await updateUserAllergies(testUserId, ["Peanuts"], 0);

    const staleResult = await updateUserAllergies(testUserId, ["Shellfish"], 0);
    const current = await getUserAllergies(testUserId);

    expect(staleResult).toEqual({
      applied: false,
      version: 2,
      stale: true,
    });
    expect(current).toEqual({
      allergies: ["Peanuts"],
      version: 2,
    });
  });
});
