// @vitest-environment node
/**
 * What queues AI filling foods' gaps: one job over the foods with a gap the options cover, and
 * nothing while AI is off or with no option on; a new food is filled by the administrator's options,
 * and Fill gaps queues a fill job and an icon job over every listed food.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AutomaticIngredientsConfig } from "@norish/config/zod/server-config";
import { DEFAULT_AUTOMATIC_INGREDIENTS } from "@norish/config/zod/server-config";
import {
  addFillGapsJobs,
  addIngredientFillJob,
  addNewFoodsFillJob,
  isFillGapsRunning,
} from "@norish/queue/ingredient-fill/producer";

const config = vi.hoisted(() => ({
  isAIEnabled: vi.fn(async () => true),
  getAutomaticIngredientsConfig: vi.fn(),
}));
const fills = vi.hoisted(() => ({
  listFoodsWithGaps: vi.fn(async (ids: readonly string[]) =>
    ids.filter((id) => id !== "onion").map((id) => ({ id, name: `${id}!` }))
  ),
}));
const icons = vi.hoisted(() => ({
  listFoodsShowingNoIcon: vi.fn(async (ids: readonly string[]) =>
    ids.filter((id) => id === "knaks").map((id) => ({ id, name: `${id}!` }))
  ),
}));
const catalogue = vi.hoisted(() => ({
  listListedIngredientIds: vi.fn(async () => ["onion", "knaks"]),
}));
const [fillQueue, iconQueue] = vi.hoisted(() =>
  [0, 1].map(() => ({
    add: vi.fn(async () => ({ id: "job-1" })),
    getJobs: vi.fn(async (): Promise<Array<{ name: string }>> => []),
  }))
);

vi.mock("@norish/shared-server/config/server-config-loader", () => config);
vi.mock("@norish/shared-server/ingredients/nutrition/fill-gaps", () => fills);
vi.mock("@norish/shared-server/ingredients/icon-rounds", () => icons);
vi.mock("@norish/db/repositories/ingredient-catalogue", () => catalogue);
vi.mock("@norish/queue/registry", () => ({
  getQueues: () => ({ ingredientFill: fillQueue, ingredientIcons: iconQueue }),
}));

function automatic(options: Partial<AutomaticIngredientsConfig>) {
  config.getAutomaticIngredientsConfig.mockResolvedValue({
    ...DEFAULT_AUTOMATIC_INGREDIENTS,
    ...options,
  });
}

beforeEach(() => {
  config.isAIEnabled.mockResolvedValue(true);
  automatic({});
  fillQueue.add.mockClear();
  iconQueue.add.mockClear();
  fills.listFoodsWithGaps.mockClear();
});

describe("addIngredientFillJob", () => {
  it("queues one job over the foods with a gap, and says how many", async () => {
    const asked = { nutrition: true, conversions: false };

    await expect(addIngredientFillJob(["onion", "knaks", "tonijn"], asked)).resolves.toBe(2);
    expect(fills.listFoodsWithGaps).toHaveBeenCalledWith(["onion", "knaks", "tonijn"], asked);
    expect(fillQueue.add).toHaveBeenCalledExactlyOnceWith("fill", {
      ingredients: [
        { id: "knaks", name: "knaks!" },
        { id: "tonijn", name: "tonijn!" },
      ],
      asked,
    });
  });

  it("queues nothing while AI is off, with no option on, or without a gap", async () => {
    config.isAIEnabled.mockResolvedValueOnce(false);
    await addIngredientFillJob(["knaks"], { nutrition: true, conversions: true });
    await addIngredientFillJob(["knaks"], { nutrition: false, conversions: false });
    await addIngredientFillJob(["onion"], { nutrition: true, conversions: true });

    expect(fillQueue.add).not.toHaveBeenCalled();
  });
});

describe("addNewFoodsFillJob", () => {
  it("fills nothing with neither fill selected", async () => {
    automatic({ cleanUp: true, icon: true });
    await addNewFoodsFillJob(["knaks"]);

    expect(fillQueue.add).not.toHaveBeenCalled();
  });

  it.each([
    [{ nutrition: true }, { nutrition: true, conversions: false }],
    [{ conversions: true }, { nutrition: false, conversions: true }],
    [
      { nutrition: true, conversions: true },
      { nutrition: true, conversions: true },
    ],
  ])("asks for what %o selects", async (options, asked) => {
    automatic(options);
    await addNewFoodsFillJob(["knaks"]);

    expect(fillQueue.add).toHaveBeenCalledExactlyOnceWith("fill", {
      ingredients: [{ id: "knaks", name: "knaks!" }],
      asked,
    });
  });
});

describe("addFillGapsJobs", () => {
  it("queues a fill job and an icon job over every listed food, by the boxes picked", async () => {
    await addFillGapsJobs({ nutrition: true, conversions: false, icons: true });

    expect(fills.listFoodsWithGaps).toHaveBeenCalledWith(["onion", "knaks"], {
      nutrition: true,
      conversions: false,
    });
    expect(fillQueue.add).toHaveBeenCalledExactlyOnceWith("fill-gaps", {
      ingredients: [{ id: "knaks", name: "knaks!" }],
      asked: { nutrition: true, conversions: false },
    });
    expect(iconQueue.add).toHaveBeenCalledExactlyOnceWith("fill-gaps", {
      ingredients: [{ id: "knaks", name: "knaks!" }],
    });
  });

  it("queues only the icons where Icons alone is picked, and no icons where it is not", async () => {
    await addFillGapsJobs({ nutrition: false, conversions: false, icons: true });
    expect(fillQueue.add).not.toHaveBeenCalled();
    expect(iconQueue.add).toHaveBeenCalledOnce();

    iconQueue.add.mockClear();
    await addFillGapsJobs({ nutrition: false, conversions: true, icons: false });
    expect(fillQueue.add).toHaveBeenCalledOnce();
    expect(iconQueue.add).not.toHaveBeenCalled();
  });
});

describe("isFillGapsRunning", () => {
  it("is on while a Fill gaps job waits or runs on either queue, never for a new food's", async () => {
    fillQueue.getJobs.mockResolvedValueOnce([{ name: "fill" }]);
    iconQueue.getJobs.mockResolvedValueOnce([{ name: "draw" }]);
    await expect(isFillGapsRunning()).resolves.toBe(false);

    iconQueue.getJobs.mockResolvedValueOnce([{ name: "fill-gaps" }]);
    await expect(isFillGapsRunning()).resolves.toBe(true);
  });
});
