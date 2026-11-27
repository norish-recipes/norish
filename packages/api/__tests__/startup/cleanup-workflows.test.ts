// @vitest-environment node
import fs from "fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanupOrphanedImages,
  cleanupOrphanedStepImages,
} from "@norish/api/startup/media-cleanup";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { createCookbook, updateCookbook } from "@norish/db/repositories/cookbooks";
import { listGroceriesByHousehold, markAllDoneInStore } from "@norish/db/repositories/groceries";
import {
  createPlannedItem,
  listPlannedItemsByHouseholdAndDateRange,
} from "@norish/db/repositories/planned-items";
import { addRecipeImages, addRecipeVideos } from "@norish/db/repositories/recipes";
import { cleanupOldCalendarData } from "@norish/queue/scheduler/old-calendar-cleanup";
import { cleanupOldGroceries } from "@norish/queue/scheduler/old-groceries-cleanup";

import {
  addTestGrocery,
  addTestRecurringGrocery,
  addTestStepImage,
  createTestRecipeStep,
  testHouseholdOf,
} from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

const testBase = new RepositoryTestBase("cleanup_workflows");

let userId: string;
let recipeId: string;
let uploadsDir: string;
let originalUploadsDir: string;
let originalCleanupMonths: number;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);

    return true;
  } catch {
    return false;
  }
}

async function createTestFile(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, "test");
}

describe("cleanup workflows", () => {
  beforeAll(async () => {
    await testBase.setup();
    originalUploadsDir = SERVER_CONFIG.UPLOADS_DIR;
    originalCleanupMonths = SERVER_CONFIG.SCHEDULER_CLEANUP_MONTHS;
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));

    const [user, recipe] = await testBase.beforeEachTest();

    userId = user.id;
    recipeId = recipe.id;
    uploadsDir = await fs.mkdtemp(path.join(os.tmpdir(), "norish-cleanup-"));

    SERVER_CONFIG.UPLOADS_DIR = uploadsDir;
    SERVER_CONFIG.SCHEDULER_CLEANUP_MONTHS = 3;

    await fs.mkdir(path.join(uploadsDir, "recipes"), { recursive: true });
  });

  afterEach(async () => {
    vi.useRealTimers();

    SERVER_CONFIG.UPLOADS_DIR = originalUploadsDir;
    SERVER_CONFIG.SCHEDULER_CLEANUP_MONTHS = originalCleanupMonths;

    if (uploadsDir) {
      await fs.rm(uploadsDir, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("reconciles recipe media references and prunes recipe directories not in recipes.id", async () => {
    const recipeDir = path.join(uploadsDir, "recipes", recipeId);
    const stepsDir = path.join(recipeDir, "steps");
    const missingRecipeId = "11111111-1111-1111-1111-111111111111";
    const missingRecipeDir = path.join(uploadsDir, "recipes", missingRecipeId);

    const referencedThumb = "thumb.jpg";
    const referencedGalleryImage = "gallery.jpg";
    const referencedVideo = "video.mp4";
    const orphanedRootImage = "orphan.jpg";
    const orphanedRootVideo = "orphan.webm";
    const referencedStepImage = "step-keep.jpg";
    const orphanedStepImage = "step-delete.jpg";

    await createTestFile(path.join(recipeDir, referencedThumb));
    await createTestFile(path.join(recipeDir, referencedGalleryImage));
    await createTestFile(path.join(recipeDir, referencedVideo));
    await createTestFile(path.join(recipeDir, orphanedRootImage));
    await createTestFile(path.join(recipeDir, orphanedRootVideo));
    await createTestFile(path.join(stepsDir, referencedStepImage));
    await createTestFile(path.join(stepsDir, orphanedStepImage));
    await createTestFile(path.join(missingRecipeDir, "obsolete.jpg"));

    await addRecipeImages(recipeId, [
      { image: `/recipes/${recipeId}/${referencedThumb}`, order: 0 },
      { image: `/recipes/${recipeId}/${referencedGalleryImage}`, order: 1 },
    ]);
    await addRecipeVideos(recipeId, [
      { video: `/recipes/${recipeId}/${referencedVideo}`, order: 0 },
    ]);

    const step = await createTestRecipeStep(recipeId, "metric", {
      step: "Add toppings",
      order: "0",
    });

    await addTestStepImage(step!.id, `/recipes/${recipeId}/steps/${referencedStepImage}`);

    const mediaResult = await cleanupOrphanedImages();
    const stepResult = await cleanupOrphanedStepImages();

    expect(mediaResult.errors).toBe(0);
    expect(stepResult.errors).toBe(0);
    expect(mediaResult.deleted).toBe(3);
    expect(stepResult.deleted).toBe(1);

    expect(await fileExists(path.join(recipeDir, referencedThumb))).toBe(true);
    expect(await fileExists(path.join(recipeDir, referencedGalleryImage))).toBe(true);
    expect(await fileExists(path.join(recipeDir, referencedVideo))).toBe(true);
    expect(await fileExists(path.join(recipeDir, orphanedRootImage))).toBe(false);
    expect(await fileExists(path.join(recipeDir, orphanedRootVideo))).toBe(false);
    expect(await fileExists(path.join(stepsDir, referencedStepImage))).toBe(true);
    expect(await fileExists(path.join(stepsDir, orphanedStepImage))).toBe(false);
    expect(await fileExists(missingRecipeDir)).toBe(false);
  });

  it("prunes cookbook folders of no cookbook and the files no cover names", async () => {
    const cookbook = await createCookbook({ userId, title: "Weeknights" });
    const cookbookDir = path.join(uploadsDir, "cookbooks", cookbook.id);
    const goneDir = path.join(uploadsDir, "cookbooks", "22222222-2222-2222-2222-222222222222");

    await createTestFile(path.join(cookbookDir, "cover.jpg"));
    await createTestFile(path.join(cookbookDir, "replaced.jpg"));
    await createTestFile(path.join(goneDir, "cover.jpg"));
    await updateCookbook(
      cookbook.id,
      { title: "Weeknights", image: `/cookbooks/${cookbook.id}/cover.jpg` },
      cookbook.version
    );

    const result = await cleanupOrphanedImages();

    expect(result).toEqual({ deleted: 2, errors: 0 });
    expect(await fileExists(path.join(cookbookDir, "cover.jpg"))).toBe(true);
    expect(await fileExists(path.join(cookbookDir, "replaced.jpg"))).toBe(false);
    expect(await fileExists(goneDir)).toBe(false);
  });

  it("deletes old calendar planned items using SCHEDULER_CLEANUP_MONTHS cutoff", async () => {
    const householdId = testHouseholdOf(userId);

    for (const [date, slot, title] of [
      ["2026-02-28", "Dinner", "Old item"],
      ["2026-03-01", "Lunch", "Cutoff item"],
      ["2026-03-02", "Breakfast", "Recent item"],
    ] as const) {
      await createPlannedItem({ householdId, userId, date, slot, itemType: "note", title });
    }

    const result = await cleanupOldCalendarData();

    expect(result.plannedItemsDeleted).toBe(2);

    const remaining = await listPlannedItemsByHouseholdAndDateRange(
      householdId,
      "2000-01-01",
      "2100-01-01"
    );

    expect(remaining.map((row) => row.date)).toEqual(["2026-03-02"]);
  });

  it("deletes old done groceries and excludes recurring items", async () => {
    const householdId = testHouseholdOf(userId);
    const { recurringGrocery: recurring } = await addTestRecurringGrocery(userId, {
      name: "Recurring milk",
      nextPlannedFor: "2026-06-20",
      alone: true,
    });
    /** A grocery ticked at `doneAt`, as the list ticks it. */
    const done = async (name: string, doneAt: string, recurringGroceryId: string | null = null) => {
      const grocery = await addTestGrocery(userId, { name, recurringGroceryId });

      vi.setSystemTime(new Date(doneAt));
      await markAllDoneInStore(householdId, null, [grocery]);
      vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    };

    await done("Delete old done", "2026-02-20T00:00:00Z");
    await done("Delete cutoff done", "2026-03-01T00:00:00Z");
    await done("Keep recurring done", "2026-01-15T00:00:00Z", recurring.id);
    await done("Keep recent done", "2026-03-02T00:00:00Z");
    await addTestGrocery(userId, { name: "Keep old undone" });

    const result = await cleanupOldGroceries();

    expect(result.deleted).toBe(2);

    const remaining = await listGroceriesByHousehold(householdId);

    expect(remaining.map((row) => row.name).sort()).toEqual([
      "Keep old undone",
      "Keep recent done",
      "Keep recurring done",
    ]);
  });
});
