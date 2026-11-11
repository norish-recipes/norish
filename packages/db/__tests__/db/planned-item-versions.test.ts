// @vitest-environment node
/**
 * A planned item's version changes only when that item is written: a slot-mate
 * renumbered by someone else's move or delete keeps its version.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Slot } from "@norish/shared/contracts";
import {
  createPlannedItem,
  deletePlannedItem,
  getPlannedItemById,
  listPlannedItemsBySlot,
  moveItem,
  updatePlannedItem,
} from "@norish/db/repositories/planned-items";

import { createTestUser } from "../helpers/db-test-helpers";
import { RepositoryTestBase } from "../helpers/repository-test-base";

const testBase = new RepositoryTestBase("planned_item_versions");
const date = "2025-01-10";

let userId: string;

beforeAll(async () => await testBase.setup());
afterAll(async () => await testBase.teardown());
beforeEach(async () => {
  await testBase.beforeEachTest();
  userId = (await createTestUser()).id;
});

async function plan(slot: Slot, title: string) {
  return createPlannedItem({ userId, date, slot, itemType: "note", title });
}

async function slotOf(slot: Slot) {
  return (await listPlannedItemsBySlot([userId], date, slot)).map(
    ({ title, sortOrder, version }) => ({ title, sortOrder, version })
  );
}

/** The slot-mate's next move, update and delete, each sent with its old version, all apply. */
async function expectWritableAt(id: string, version: number) {
  const moved = await moveItem(id, date, "Snack", 0, version);

  expect(moved.stale).toBe(false);
  const updated = await updatePlannedItem(id, { title: "renamed" }, version + 1);

  expect(updated.stale).toBe(false);
  expect((await deletePlannedItem(id, version + 2)).stale).toBe(false);
}

describe("slot-mate versions", () => {
  it("a cross-slot move renumbers both slots and bumps only the moved plan", async () => {
    const a = await plan("Dinner", "a");
    const b = await plan("Dinner", "b");
    const c = await plan("Dinner", "c");
    const x = await plan("Lunch", "x");
    const y = await plan("Lunch", "y");

    const result = await moveItem(a.id, date, "Lunch", 1, a.version);

    expect(result.stale).toBe(false);
    expect(result.value?.version).toBe(a.version + 1);
    expect(await slotOf("Dinner")).toEqual([
      { title: "b", sortOrder: 0, version: b.version },
      { title: "c", sortOrder: 1, version: c.version },
    ]);
    expect(await slotOf("Lunch")).toEqual([
      { title: "x", sortOrder: 0, version: x.version },
      { title: "a", sortOrder: 1, version: a.version + 1 },
      { title: "y", sortOrder: 2, version: y.version },
    ]);

    await expectWritableAt(b.id, b.version);
    await expectWritableAt(y.id, y.version);
  });

  it("a move within one slot bumps only the moved plan", async () => {
    const a = await plan("Dinner", "a");
    const b = await plan("Dinner", "b");
    const c = await plan("Dinner", "c");

    const result = await moveItem(c.id, date, "Dinner", 0, c.version);

    expect(result.value?.version).toBe(c.version + 1);
    expect(await slotOf("Dinner")).toEqual([
      { title: "c", sortOrder: 0, version: c.version + 1 },
      { title: "a", sortOrder: 1, version: a.version },
      { title: "b", sortOrder: 2, version: b.version },
    ]);

    await expectWritableAt(a.id, a.version);
  });

  it("a delete renumbers the plans left without bumping them", async () => {
    const a = await plan("Dinner", "a");
    const b = await plan("Dinner", "b");
    const c = await plan("Dinner", "c");

    expect((await deletePlannedItem(a.id, a.version)).stale).toBe(false);
    expect(await slotOf("Dinner")).toEqual([
      { title: "b", sortOrder: 0, version: b.version },
      { title: "c", sortOrder: 1, version: c.version },
    ]);

    await expectWritableAt(c.id, c.version);
    expect(await getPlannedItemById(c.id)).toBeNull();
  });
});
