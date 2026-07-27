// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const getRecipeFull = vi.fn();
const applyRecipeAiEdit = vi.fn();
const emitByPolicy = vi.fn();
const editRecipeWithAI = vi.fn();

vi.mock("@norish/db", () => ({
  getRecipeFull,
  applyRecipeAiEdit,
}));

vi.mock("@norish/queue/api-handlers", () => ({
  requireQueueApiHandler: vi.fn(() => editRecipeWithAI),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "everyone" }),
}));

vi.mock("@norish/shared-server/realtime/policy", () => ({
  emitByPolicy,
}));

vi.mock("@norish/shared-server/realtime/recipes", () => ({
  recipeEmitter: {},
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const JOB = {
  id: "job-1",
  attemptsMade: 0,
  opts: { attempts: 2 },
  data: {
    recipeId: "recipe-123",
    userId: "user-1",
    householdKey: "household-1",
    instruction: "make it vegan",
    version: 5,
  },
  updateProgress: vi.fn(),
  log: vi.fn(),
} as any;

const existingRecipe = {
  id: "recipe-123",
  name: "Carbonara",
  systemUsed: "metric",
  version: 5,
  image: "recipes/img.jpg",
  url: "https://example.com",
  recipeIngredients: [],
  steps: [],
};

const editedDto = {
  name: "Vegan Carbonara",
  description: "veganized",
  notes: null,
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 15,
  totalMinutes: 25,
  calories: 500,
  fat: "15",
  carbs: "60",
  protein: "20",
  categories: ["Dinner"],
  tags: [{ name: "vegan" }],
  // Dual-system output, exactly as the normalizer produces it.
  recipeIngredients: [
    { ingredientName: "tofu", amount: 200, unit: "g", systemUsed: "metric", order: 0 },
    { ingredientName: "tofu", amount: 7, unit: "oz", systemUsed: "us", order: 0 },
  ],
  steps: [
    { step: "cook tofu", order: 0, systemUsed: "metric" },
    { step: "cook tofu", order: 0, systemUsed: "us" },
  ],
  images: [{ image: "should-be-ignored.jpg", order: 0 }],
  videos: [],
  url: "https://ai-should-not-set-this.com",
  systemUsed: "us",
};

async function loadWorker() {
  return import("../../src/recipe-ai-edit/worker");
}

describe("processRecipeAiEditJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRecipeFull.mockResolvedValue(existingRecipe);
    editRecipeWithAI.mockResolvedValue({ success: true, data: editedDto });
    applyRecipeAiEdit.mockResolvedValue({ stale: false });
  });

  it("edits the recipe, forwards both systems, preserves media/url, and emits updated + completed", async () => {
    const { processRecipeAiEditJob } = await loadWorker();

    // Second getRecipeFull call (post-update) returns updated recipe.
    getRecipeFull
      .mockResolvedValueOnce(existingRecipe)
      .mockResolvedValueOnce({ ...existingRecipe, name: "Vegan Carbonara" });

    await processRecipeAiEditJob(JOB);

    expect(editRecipeWithAI).toHaveBeenCalledWith(existingRecipe, "make it vegan", "recipe-123");

    // Persists with the job's version; preserves existing systemUsed; forwards
    // BOTH measurement systems; does NOT forward AI-provided images/videos/url.
    expect(applyRecipeAiEdit).toHaveBeenCalledTimes(1);
    const [rid, uid, payload, version] = applyRecipeAiEdit.mock.calls[0];
    expect(rid).toBe("recipe-123");
    expect(uid).toBe("user-1");
    expect(version).toBe(5);
    expect(payload.name).toBe("Vegan Carbonara");
    expect(payload.systemUsed).toBe("metric"); // preserved, not the AI's "us"
    expect(payload.recipeIngredients.map((i: { systemUsed: string }) => i.systemUsed)).toEqual([
      "metric",
      "us",
    ]);
    expect(payload.steps.map((s: { systemUsed: string }) => s.systemUsed)).toEqual([
      "metric",
      "us",
    ]);
    expect(payload).not.toHaveProperty("images");
    expect(payload).not.toHaveProperty("videos");
    expect(payload).not.toHaveProperty("url");

    const events = emitByPolicy.mock.calls.map((c) => c[3]);
    expect(events).toContain("aiEditStarted");
    expect(events).toContain("updated");
    expect(events).toContain("aiEditCompleted");
  });

  it("does not emit updated when the update is stale", async () => {
    applyRecipeAiEdit.mockResolvedValue({ stale: true });

    const { processRecipeAiEditJob } = await loadWorker();

    await processRecipeAiEditJob(JOB);

    const events = emitByPolicy.mock.calls.map((c) => c[3]);
    expect(events).toContain("aiEditStarted");
    expect(events).toContain("aiEditCompleted");
    expect(events).not.toContain("updated");
  });

  it("only emits the start toast on the first attempt", async () => {
    const { processRecipeAiEditJob } = await loadWorker();

    await processRecipeAiEditJob({ ...JOB, attemptsMade: 1 });

    const events = emitByPolicy.mock.calls.map((c) => c[3]);
    expect(events).not.toContain("aiEditStarted");
  });

  it("throws when the recipe is not found", async () => {
    getRecipeFull.mockResolvedValue(null);

    const { processRecipeAiEditJob } = await loadWorker();

    await expect(processRecipeAiEditJob(JOB)).rejects.toThrow(/not found/i);
    expect(applyRecipeAiEdit).not.toHaveBeenCalled();
  });

  it("throws when the AI edit fails", async () => {
    editRecipeWithAI.mockResolvedValue({ success: false, error: "boom" });

    const { processRecipeAiEditJob } = await loadWorker();

    await expect(processRecipeAiEditJob(JOB)).rejects.toThrow("boom");
    expect(applyRecipeAiEdit).not.toHaveBeenCalled();
  });
});
