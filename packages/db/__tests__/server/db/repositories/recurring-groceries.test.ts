// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  checkRecurringGrocery,
  createRecurringGrocery,
  deleteRecurringGroceryById,
  detachRecurringGrocery,
  updateRecurringGroceryWithGrocery,
} from "@norish/db/repositories/recurring-groceries";
import { groceries, recurringGroceries, stores } from "@norish/db/schema";

import { getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("recurring groceries transactional writes", () => {
  const testBase = new RepositoryTestBase("test_recurring_groceries");

  let testUserId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    testUserId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function createRecurringWithGrocery() {
    const recurring = await createRecurringGrocery({
      id: crypto.randomUUID(),
      userId: testUserId,
      name: "Milk",
      amount: 1,
      unit: "liter",
      recurrenceRule: "week",
      recurrenceInterval: 1,
      recurrenceWeekday: null,
      nextPlannedFor: "2026-07-01",
      lastCheckedDate: null,
    });

    const db = getTestDb();
    const [grocery] = await db
      .insert(groceries)
      .values({
        userId: testUserId,
        name: "Milk",
        unit: "liter",
        amount: "1",
        isDone: false,
        recurringGroceryId: recurring.id,
      })
      .returning();

    return { recurring, grocery };
  }

  describe("detachRecurringGrocery", () => {
    it("deletes the recurring row and applies the grocery edit atomically", async () => {
      const { recurring, grocery } = await createRecurringWithGrocery();

      const outcome = await detachRecurringGrocery({
        recurringGroceryId: recurring.id,
        recurringVersion: recurring.version,
        grocery: {
          id: grocery.id,
          version: grocery.version,
          name: "Oat milk",
          unit: "liter",
          amount: 2,
        },
      });

      const db = getTestDb();
      const recurringRows = await db
        .select()
        .from(recurringGroceries)
        .where(eq(recurringGroceries.id, recurring.id));
      const [stored] = await db.select().from(groceries).where(eq(groceries.id, grocery.id));

      expect(outcome.stale).toBe(false);
      expect(recurringRows).toEqual([]);
      expect(stored?.name).toBe("Oat milk");
      expect(stored?.recurringGroceryId).toBeNull();
      expect(stored?.version).toBe(grocery.version + 1);
    });

    it("rolls back the recurring delete when the grocery version is stale", async () => {
      const { recurring, grocery } = await createRecurringWithGrocery();

      const outcome = await detachRecurringGrocery({
        recurringGroceryId: recurring.id,
        recurringVersion: recurring.version,
        grocery: {
          id: grocery.id,
          version: grocery.version + 5,
          name: "Oat milk",
          unit: "liter",
          amount: 2,
        },
      });

      const db = getTestDb();
      const [recurringRow] = await db
        .select()
        .from(recurringGroceries)
        .where(eq(recurringGroceries.id, recurring.id));
      const [stored] = await db.select().from(groceries).where(eq(groceries.id, grocery.id));

      expect(outcome.stale).toBe(true);
      // The whole transaction rolled back: recurring row survives, grocery untouched
      expect(recurringRow?.id).toBe(recurring.id);
      expect(stored?.name).toBe("Milk");
      expect(stored?.recurringGroceryId).toBe(recurring.id);
      expect(stored?.version).toBe(grocery.version);
    });

    it("changes nothing when the recurring version is stale", async () => {
      const { recurring, grocery } = await createRecurringWithGrocery();

      const outcome = await detachRecurringGrocery({
        recurringGroceryId: recurring.id,
        recurringVersion: recurring.version + 5,
        grocery: {
          id: grocery.id,
          version: grocery.version,
          name: "Oat milk",
          unit: "liter",
          amount: 2,
        },
      });

      const db = getTestDb();
      const [recurringRow] = await db
        .select()
        .from(recurringGroceries)
        .where(eq(recurringGroceries.id, recurring.id));
      const [stored] = await db.select().from(groceries).where(eq(groceries.id, grocery.id));

      expect(outcome.stale).toBe(true);
      expect(recurringRow?.id).toBe(recurring.id);
      expect(stored?.name).toBe("Milk");
      expect(stored?.version).toBe(grocery.version);
    });
  });

  describe("updateRecurringGroceryWithGrocery", () => {
    it("updates both rows and bumps both versions", async () => {
      const { recurring, grocery } = await createRecurringWithGrocery();

      const outcome = await updateRecurringGroceryWithGrocery(
        { id: recurring.id, version: recurring.version, name: "Oat milk" },
        { id: grocery.id, version: grocery.version }
      );

      const db = getTestDb();
      const [recurringRow] = await db
        .select()
        .from(recurringGroceries)
        .where(eq(recurringGroceries.id, recurring.id));
      const [stored] = await db.select().from(groceries).where(eq(groceries.id, grocery.id));

      expect(outcome.stale).toBe(false);
      expect(recurringRow?.name).toBe("Oat milk");
      expect(recurringRow?.version).toBe(recurring.version + 1);
      expect(stored?.name).toBe("Oat milk");
      expect(stored?.version).toBe(grocery.version + 1);
    });

    it("applies a store change to the grocery when provided", async () => {
      const { recurring, grocery } = await createRecurringWithGrocery();
      const db = getTestDb();
      const [store] = await db
        .insert(stores)
        .values({ userId: testUserId, name: "Bakery", color: "primary", icon: "ShoppingBagIcon" })
        .returning();

      const outcome = await updateRecurringGroceryWithGrocery(
        { id: recurring.id, version: recurring.version, name: "Oat milk" },
        { id: grocery.id, version: grocery.version, storeId: store.id }
      );

      const [stored] = await db.select().from(groceries).where(eq(groceries.id, grocery.id));

      expect(outcome.stale).toBe(false);
      expect(stored?.storeId).toBe(store.id);
    });

    it("rolls back the recurring update when the grocery version is stale", async () => {
      const { recurring, grocery } = await createRecurringWithGrocery();

      const outcome = await updateRecurringGroceryWithGrocery(
        { id: recurring.id, version: recurring.version, name: "Oat milk" },
        { id: grocery.id, version: grocery.version + 5 }
      );

      const db = getTestDb();
      const [recurringRow] = await db
        .select()
        .from(recurringGroceries)
        .where(eq(recurringGroceries.id, recurring.id));
      const [stored] = await db.select().from(groceries).where(eq(groceries.id, grocery.id));

      expect(outcome.stale).toBe(true);
      expect(recurringRow?.name).toBe("Milk");
      expect(recurringRow?.version).toBe(recurring.version);
      expect(stored?.name).toBe("Milk");
      expect(stored?.version).toBe(grocery.version);
    });
  });

  describe("checkRecurringGrocery", () => {
    it("toggles the grocery and advances the recurring schedule atomically", async () => {
      const { recurring, grocery } = await createRecurringWithGrocery();

      const outcome = await checkRecurringGrocery({
        groceryId: grocery.id,
        groceryVersion: grocery.version,
        isDone: true,
        recurringUpdate: {
          id: recurring.id,
          version: recurring.version,
          lastCheckedDate: "2026-07-01",
          nextPlannedFor: "2026-07-08",
        },
      });

      const db = getTestDb();
      const [recurringRow] = await db
        .select()
        .from(recurringGroceries)
        .where(eq(recurringGroceries.id, recurring.id));
      const [stored] = await db.select().from(groceries).where(eq(groceries.id, grocery.id));

      expect(outcome.stale).toBe(false);
      expect(stored?.isDone).toBe(true);
      expect(recurringRow?.nextPlannedFor).toBe("2026-07-08");
      expect(recurringRow?.lastCheckedDate).toBe("2026-07-01");
    });

    it("rolls back the grocery toggle when the recurring version is stale", async () => {
      const { recurring, grocery } = await createRecurringWithGrocery();

      const outcome = await checkRecurringGrocery({
        groceryId: grocery.id,
        groceryVersion: grocery.version,
        isDone: true,
        recurringUpdate: {
          id: recurring.id,
          version: recurring.version + 5,
          lastCheckedDate: "2026-07-01",
          nextPlannedFor: "2026-07-08",
        },
      });

      const db = getTestDb();
      const [recurringRow] = await db
        .select()
        .from(recurringGroceries)
        .where(eq(recurringGroceries.id, recurring.id));
      const [stored] = await db.select().from(groceries).where(eq(groceries.id, grocery.id));

      expect(outcome.stale).toBe(true);
      // The grocery toggle must not survive the failed recurring update
      expect(stored?.isDone).toBe(false);
      expect(stored?.version).toBe(grocery.version);
      expect(recurringRow?.nextPlannedFor).toBe("2026-07-01");
    });

    it("skips the recurring update when unchecking", async () => {
      const { grocery } = await createRecurringWithGrocery();

      const outcome = await checkRecurringGrocery({
        groceryId: grocery.id,
        groceryVersion: grocery.version,
        isDone: false,
        recurringUpdate: null,
      });

      expect(outcome.stale).toBe(false);
      expect(outcome.value?.recurringGrocery).toBeNull();
      expect(outcome.value?.grocery.isDone).toBe(false);
    });
  });

  describe("deleteRecurringGroceryById", () => {
    it("deletes the recurring row and its linked groceries together", async () => {
      const { recurring, grocery } = await createRecurringWithGrocery();

      const result = await deleteRecurringGroceryById(recurring.id, recurring.version);

      const db = getTestDb();
      const recurringRows = await db
        .select()
        .from(recurringGroceries)
        .where(eq(recurringGroceries.id, recurring.id));
      const groceryRows = await db.select().from(groceries).where(eq(groceries.id, grocery.id));

      expect(result).toEqual({ stale: false, deletedGroceryIds: [grocery.id] });
      expect(recurringRows).toEqual([]);
      expect(groceryRows).toEqual([]);
    });

    it("deletes nothing when the recurring version is stale", async () => {
      const { recurring, grocery } = await createRecurringWithGrocery();

      const result = await deleteRecurringGroceryById(recurring.id, recurring.version + 5);

      const db = getTestDb();
      const [recurringRow] = await db
        .select()
        .from(recurringGroceries)
        .where(eq(recurringGroceries.id, recurring.id));
      const [storedGrocery] = await db
        .select()
        .from(groceries)
        .where(eq(groceries.id, grocery.id));

      expect(result).toEqual({ stale: true, deletedGroceryIds: [] });
      expect(recurringRow?.id).toBe(recurring.id);
      expect(storedGrocery?.id).toBe(grocery.id);
      expect(storedGrocery?.recurringGroceryId).toBe(recurring.id);
    });
  });
});
