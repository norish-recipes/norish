// @vitest-environment node
/**
 * How catalogue edits announce what they changed: on their own, or held
 * back and announced together for a run of many edits at once.
 */
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import {
  announcingTogether,
  ingredientChanges,
  publishIngredientChangesTo,
} from "@norish/shared-server/ingredients/changes";

vi.mock("@norish/shared-server/realtime/ingredients", () => ({
  ingredients: { publish: vi.fn() },
}));

const announced: string[][] = [];
const restore = publishIngredientChangesTo({
  changed: async (ids) => void announced.push([...ids]),
});

afterEach(() => {
  announced.length = 0;
});

afterAll(restore);

describe("announcing Ingredient changes", () => {
  it("announces an edit on its own", async () => {
    await ingredientChanges().changed(["onion"], "household-a");

    expect(announced).toEqual([["onion"]]);
  });

  it("holds a run's changes back and announces them once, together, each food once", async () => {
    const result = await announcingTogether(async () => {
      await ingredientChanges().changed(["uien", "onion"], "household-a");
      await ingredientChanges().changed(["onion", "shallot"], "household-a");
      expect(announced).toEqual([]);

      return "done";
    });

    expect(result).toBe("done");
    expect(announced).toEqual([["uien", "onion", "shallot"]]);
  });

  it("announces what was held even when the run fails partway", async () => {
    await expect(
      announcingTogether(async () => {
        await ingredientChanges().changed(["uien"], "household-a");
        throw new Error("database away");
      })
    ).rejects.toThrow("database away");

    expect(announced).toEqual([["uien"]]);
  });

  it("keeps two runs, and an edit outside them, apart", async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));

    const first = announcingTogether(async () => {
      await ingredientChanges().changed(["a"], "household-a");
      await gate;
      await ingredientChanges().changed(["b"], "household-a");
    });
    const second = announcingTogether(async () => {
      await ingredientChanges().changed(["c"], "household-a");
    });

    await second;
    await ingredientChanges().changed(["outside"], "household-a");
    release();
    await first;

    expect(announced).toEqual([["c"], ["outside"], ["a", "b"]]);
  });

  it("announces nothing for a run that changed nothing", async () => {
    await announcingTogether(async () => undefined);

    expect(announced).toEqual([]);
  });
});
