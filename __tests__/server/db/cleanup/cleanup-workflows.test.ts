// @vitest-environment node
import fs from "fs/promises";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { createTestRecipeStep, getTestDb, type TestDb } from "@/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "@/__tests__/helpers/repository-test-base";
import {
  groceries,
  plannedItems,
  recipeImages,
  recipeVideos,
  recipes,
  recurringGroceries,
  stepImages,
} from "@/server/db/schema";
import { cleanupOldCalendarData } from "@/server/scheduler/old-calendar-cleanup";
import { cleanupOldGroceries } from "@/server/scheduler/old-groceries-cleanup";
import { cleanupOrphanedImages, cleanupOrphanedStepImages } from "@/server/startup/media-cleanup";

const testBase = new RepositoryTestBase("cleanup_workflows");

let db: TestDb;
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
    db = getTestDb();
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

    (SERVER_CONFIG as any).UPLOADS_DIR = uploadsDir;
    (SERVER_CONFIG as any).SCHEDULER_CLEANUP_MONTHS = 3;

    await fs.mkdir(path.join(uploadsDir, "recipes"), { recursive: true });
  });

  afterEach(async () => {
    vi.useRealTimers();

    (SERVER_CONFIG as any).UPLOADS_DIR = originalUploadsDir;
    (SERVER_CONFIG as any).SCHEDULER_CLEANUP_MONTHS = originalCleanupMonths;

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

    await db
      .update(recipes)
      .set({ image: `/recipes/${recipeId}/${referencedThumb}` })
      .where(eq(recipes.id, recipeId));

    await db.insert(recipeImages).values({
      recipeId,
      image: `/recipes/${recipeId}/${referencedGalleryImage}`,
      order: "0",
    });

    await db.insert(recipeVideos).values({
      recipeId,
      video: `/recipes/${recipeId}/${referencedVideo}`,
      order: "0",
    });

    const step = await createTestRecipeStep(recipeId, "metric", {
      step: "Add toppings",
      order: "0",
    });

    await db.insert(stepImages).values({
      stepId: step.id,
      image: `/recipes/${recipeId}/steps/${referencedStepImage}`,
      order: "0",
    });

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

  it("deletes old calendar planned items using SCHEDULER_CLEANUP_MONTHS cutoff", async () => {
    await db.insert(plannedItems).values([
      {
        userId,
        date: "2026-02-28",
        slot: "Dinner",
        itemType: "note",
        title: "Old item",
      },
      {
        userId,
        date: "2026-03-01",
        slot: "Lunch",
        itemType: "note",
        title: "Cutoff item",
      },
      {
        userId,
        date: "2026-03-02",
        slot: "Breakfast",
        itemType: "note",
        title: "Recent item",
      },
    ]);

    const result = await cleanupOldCalendarData();

    expect(result.plannedItemsDeleted).toBe(2);

    const remaining = await db
      .select({ date: plannedItems.date })
      .from(plannedItems)
      .where(eq(plannedItems.userId, userId));

    expect(remaining).toEqual([{ date: "2026-03-02" }]);
  });

  it("deletes old done groceries and excludes recurring items", async () => {
    const [recurring] = await db
      .insert(recurringGroceries)
      .values({
        userId,
        name: "Recurring milk",
        recurrenceRule: "week",
        nextPlannedFor: "2026-06-20",
      })
      .returning({ id: recurringGroceries.id });

    await db.insert(groceries).values([
      {
        userId,
        name: "Delete old done",
        isDone: true,
        updatedAt: new Date("2026-02-20T00:00:00Z"),
      },
      {
        userId,
        name: "Delete cutoff done",
        isDone: true,
        updatedAt: new Date("2026-03-01T00:00:00Z"),
      },
      {
        userId,
        name: "Keep recurring done",
        isDone: true,
        recurringGroceryId: recurring.id,
        updatedAt: new Date("2026-01-15T00:00:00Z"),
      },
      {
        userId,
        name: "Keep recent done",
        isDone: true,
        updatedAt: new Date("2026-03-02T00:00:00Z"),
      },
      {
        userId,
        name: "Keep old undone",
        isDone: false,
        updatedAt: new Date("2026-01-10T00:00:00Z"),
      },
    ]);

    const result = await cleanupOldGroceries();

    expect(result.deleted).toBe(2);

    const remaining = await db
      .select({ name: groceries.name })
      .from(groceries)
      .where(eq(groceries.userId, userId));

    expect(remaining.map((row) => row.name)).toEqual([
      "Keep recurring done",
      "Keep recent done",
      "Keep old undone",
    ]);
  });
});
