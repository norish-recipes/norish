/**
 * What the administrator turned on for new foods, run per food: the Plain
 * Name first, so the icon is drawn from the name the food ends up with; a
 * failure is one food's, and nothing is queued while both are off. The
 * shared-server pieces are mocked; each is tested against the database.
 */
import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NewIngredientsJobData } from "@norish/queue/contracts/job-types";

const settings = vi.hoisted(() => ({ value: { plainName: true, icon: true } }));
const calls = vi.hoisted(() => [] as string[]);
const plainNames = vi.hoisted(() => ({
  giveNewIngredientItsPlainName: vi.fn(async (id: string) => void calls.push(`name:${id}`)),
}));
const icons = vi.hoisted(() => ({
  drawNewIngredientIcon: vi.fn(async (id: string) => {
    calls.push(`icon:${id}`);

    return true;
  }),
}));
const queue = vi.hoisted(() => ({ add: vi.fn(async () => ({ id: "job-1" })) }));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getAutomaticIngredientsConfig: async () => settings.value,
}));
vi.mock("@norish/shared-server/ingredients/plain-names", () => plainNames);
vi.mock("@norish/shared-server/ingredients/icon-rounds", () => icons);
vi.mock("@norish/queue/redis/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/queue/registry", () => ({ getQueues: () => ({ newIngredients: queue }) }));
vi.mock("@norish/queue/job-steps", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  reportStep: vi.fn(async () => undefined),
}));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { processNewIngredientsJob } = await import("@norish/queue/new-ingredients/worker");
const { addNewIngredientsJob } = await import("@norish/queue/new-ingredients/producer");

function job(ingredientIds: string[]) {
  return { id: "job-1", data: { ingredientIds } } as unknown as Job<NewIngredientsJobData>;
}

beforeEach(() => {
  calls.length = 0;
  settings.value = { plainName: true, icon: true };
  plainNames.giveNewIngredientItsPlainName.mockClear();
  icons.drawNewIngredientIcon.mockClear();
  queue.add.mockClear();
});

describe("processNewIngredientsJob", () => {
  it("names each food before drawing it, one food after another", async () => {
    await processNewIngredientsJob(job(["a", "b"]));

    expect(calls).toEqual(["name:a", "icon:a", "name:b", "icon:b"]);
  });

  it("does only what is turned on", async () => {
    settings.value = { plainName: false, icon: true };
    await processNewIngredientsJob(job(["a"]));

    expect(calls).toEqual(["icon:a"]);
  });

  it("keeps going past a food whose question or drawing failed", async () => {
    plainNames.giveNewIngredientItsPlainName.mockRejectedValueOnce(new Error("rate limited"));
    icons.drawNewIngredientIcon.mockRejectedValueOnce(new Error("refused"));
    await processNewIngredientsJob(job(["a", "b"]));

    expect(calls).toEqual(["name:b", "icon:b"]);
  });
});

describe("addNewIngredientsJob", () => {
  it("queues the new foods while anything is turned on, and nothing otherwise", async () => {
    await addNewIngredientsJob(["a"]);
    expect(queue.add).toHaveBeenCalledExactlyOnceWith("upkeep", { ingredientIds: ["a"] });

    settings.value = { plainName: false, icon: false };
    await addNewIngredientsJob(["b"]);
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
