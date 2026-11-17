// @vitest-environment node
/**
 * A planned item's edit is one write: whichever of title, date and slot it names change together
 * under one version check and one bump, the item landing last in a new slot.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Slot } from "@norish/shared/contracts";
import {
  createPlannedItem,
  editPlannedItem,
  getPlannedItemById,
  listPlannedItemsBySlot,
  moveItem,
} from "@norish/db/repositories/planned-items";

import { createTestUser } from "../helpers/db-test-helpers";
import { RepositoryTestBase } from "../helpers/repository-test-base";

const testBase = new RepositoryTestBase("planned_item_edit");
const date = "2025-01-10";
const nextDay = "2025-01-11";

let userId: string;

beforeAll(async () => await testBase.setup());
afterAll(async () => await testBase.teardown());
beforeEach(async () => {
  await testBase.beforeEachTest();
  userId = (await createTestUser()).id;
});

async function plan(slot: Slot, title: string, day = date) {
  return createPlannedItem({ userId, date: day, slot, itemType: "note", title });
}

async function titlesIn(day: string, slot: Slot) {
  return (await listPlannedItemsBySlot([userId], day, slot)).map(({ title, sortOrder }) => [
    title,
    sortOrder,
  ]);
}

describe("editPlannedItem", () => {
  it.each([
    ["title only", { title: "Leek soup" }, { title: "Leek soup", date, slot: "Dinner" }],
    ["date only", { date: nextDay }, { title: "Soup", date: nextDay, slot: "Dinner" }],
    ["slot only", { slot: "Lunch" }, { title: "Soup", date, slot: "Lunch" }],
    [
      "date and slot",
      { date: nextDay, slot: "Lunch" },
      { title: "Soup", date: nextDay, slot: "Lunch" },
    ],
    [
      "title and date",
      { title: "Leek soup", date: nextDay },
      { title: "Leek soup", date: nextDay, slot: "Dinner" },
    ],
    [
      "all three",
      { title: "Leek soup", date: nextDay, slot: "Lunch" },
      { title: "Leek soup", date: nextDay, slot: "Lunch" },
    ],
  ] as const)("%s: stored together, bumped once", async (_, edit, expected) => {
    const soup = await plan("Dinner", "Soup");

    const result = await editPlannedItem(soup.id, edit, soup.version);

    expect(result.stale).toBe(false);
    expect(await getPlannedItemById(soup.id)).toMatchObject({
      ...expected,
      version: soup.version + 1,
    });
  });

  it("nothing: writes nothing and keeps the version", async () => {
    const soup = await plan("Dinner", "Soup");

    const result = await editPlannedItem(soup.id, {}, soup.version);

    expect(result).toMatchObject({ stale: false, value: { version: soup.version } });
    expect(await getPlannedItemById(soup.id)).toMatchObject({ title: "Soup", version: 1 });
  });

  it("a date or slot named as it is moves nothing", async () => {
    const soup = await plan("Dinner", "Soup");

    await plan("Dinner", "Salad");
    await editPlannedItem(soup.id, { title: "Leek soup", date, slot: "Dinner" }, soup.version);

    expect(await titlesIn(date, "Dinner")).toEqual([
      ["Leek soup", 0],
      ["Salad", 1],
    ]);
  });

  it("lands last in the new slot and closes the gap it left", async () => {
    const soup = await plan("Dinner", "Soup");

    await plan("Dinner", "Salad");
    await plan("Lunch", "Toast", nextDay);
    await editPlannedItem(soup.id, { title: "Leek soup", date: nextDay, slot: "Lunch" }, 1);

    expect(await titlesIn(date, "Dinner")).toEqual([["Salad", 0]]);
    expect(await titlesIn(nextDay, "Lunch")).toEqual([
      ["Toast", 0],
      ["Leek soup", 1],
    ]);
  });

  it("refuses the whole edit at another version", async () => {
    const soup = await plan("Dinner", "Soup");

    const result = await editPlannedItem(
      soup.id,
      { title: "Leek soup", date: nextDay, slot: "Lunch" },
      soup.version + 1
    );

    expect(result.stale).toBe(true);
    expect(await getPlannedItemById(soup.id)).toMatchObject({
      title: "Soup",
      date,
      slot: "Dinner",
      version: soup.version,
    });
  });

  it("is stale for a removed item", async () => {
    const result = await editPlannedItem(
      "00000000-0000-4000-8000-000000000001",
      { title: "Leek soup" },
      1
    );

    expect(result.stale).toBe(true);
  });
});

describe("two writes at one version", () => {
  // Each answer is applied or stale; the loser leaves no renumbering behind.
  async function race(writes: (soupId: string) => Promise<{ stale: boolean }>[]) {
    const soup = await plan("Dinner", "Soup");

    await plan("Dinner", "Salad");
    await plan("Lunch", "Toast", nextDay);
    // The pool is reset per suite: warm two connections so the writes really overlap.
    await Promise.all([getPlannedItemById(soup.id), getPlannedItemById(soup.id)]);
    const results = await Promise.all(writes(soup.id));

    expect(results.map(({ stale }) => stale).sort()).toEqual([false, true]);
    expect((await titlesIn(nextDay, "Lunch")).map(([, sortOrder]) => sortOrder)).toEqual([0, 1]);
    expect(await titlesIn(date, "Dinner")).toEqual([["Salad", 0]]);
    expect(await getPlannedItemById(soup.id)).toMatchObject({ version: 2 });
  }

  it("an edit and a move: one applies, the other writes nothing", async () => {
    await race((id) => [
      editPlannedItem(id, { date: nextDay, slot: "Lunch" }, 1),
      moveItem(id, nextDay, "Lunch", 0, 1),
    ]);
  });

  it("two moves: one applies, the other writes nothing", async () => {
    await race((id) => [
      moveItem(id, nextDay, "Lunch", 0, 1),
      moveItem(id, nextDay, "Lunch", 1, 1),
    ]);
  });
});
