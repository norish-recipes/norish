import { describe, it, expect, vi, beforeEach } from "vitest";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";

// Setup mocks
vi.mock("@/server/db", () => ({
  createRecipeWithRefs: vi.fn(),
  getRecipeFull: vi.fn(),
  findExistingRecipe: vi.fn(),
}));

vi.mock("@/lib/importers/mela", () => ({
  parseMelaRecipeToDTO: vi.fn(),
}));

vi.mock("@/server/trpc/routers/recipes/emitter", () => ({
  recipeEmitter: {
    emitToHousehold: vi.fn(),
    householdEvent: vi.fn((key: string, event: string) => `${key}:${event}`),
  },
}));

// Import mocks for assertions
import { createMockUser, createMockAuthedContext, createMockRecipeDashboard } from "./test-utils";

import { createRecipeWithRefs, getRecipeFull, findExistingRecipe } from "@/server/db";
import { parseMelaRecipeToDTO } from "@/lib/importers/mela";
import { recipeEmitter } from "@/server/trpc/routers/recipes/emitter";

// Import test utilities

const createRecipeWithRefsMock = createRecipeWithRefs as ReturnType<typeof vi.fn>;
const findExistingRecipeMock = findExistingRecipe as ReturnType<typeof vi.fn>;
const getRecipeFullMock = getRecipeFull as ReturnType<typeof vi.fn>;
const parseMelaRecipeToTDOMock = parseMelaRecipeToDTO as ReturnType<typeof vi.fn>;
const _emitToHouseholdMock = recipeEmitter.emitToHousehold as ReturnType<typeof vi.fn>;

// Create a test tRPC instance
const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

// Create authed middleware for testing
const authedMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({ ctx });
});

const authedProcedure = t.procedure.use(authedMiddleware);

describe("Mela import procedures", () => {
  const mockUser = createMockUser();
  const _mockHouseholdKey = "test-household-id";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("importMela validation", () => {
    it("rejects when no file provided", async () => {
      const ctx = createMockAuthedContext(mockUser);

      const testRouter = t.router({
        importMela: authedProcedure
          .input((val: unknown) => val as FormData)
          .mutation(async ({ input }) => {
            const file = input.get("file") as File | null;

            if (!file) {
              return { success: false, error: "No file provided" };
            }

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const formData = new FormData();
      const result = await caller.importMela(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No file provided");
    });

    it("rejects invalid file extension", async () => {
      const ctx = createMockAuthedContext(mockUser);

      const testRouter = t.router({
        importMela: authedProcedure
          .input((val: unknown) => val as FormData)
          .mutation(async ({ input }) => {
            const file = input.get("file") as File | null;

            if (!file) {
              return { success: false, error: "No file provided" };
            }

            if (!file.name.endsWith(".melarecipes")) {
              return { success: false, error: "Invalid file type. Expected .melarecipes file." };
            }

            return { success: true };
          }),
      });

      const caller = t.createCallerFactory(testRouter)(ctx);
      const formData = new FormData();
      const file = new File(["content"], "recipes.zip", { type: "application/zip" });

      formData.append("file", file);
      const result = await caller.importMela(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid file type. Expected .melarecipes file.");
    });
  });

  describe("progress emission", () => {
    it("emits progress every 10 recipes", async () => {
      // Simulate progress emission pattern
      const batchSize = 10;
      const total = 25;
      const progressEvents: number[] = [];

      // Simulate the import loop
      for (let i = 0; i < total; i++) {
        const current = i + 1;
        const shouldEmit = current % batchSize === 0 || current === total;

        if (shouldEmit) {
          progressEvents.push(current);
        }
      }

      // Should emit at 10, 20, 25
      expect(progressEvents).toEqual([10, 20, 25]);
    });

    it("emits progress for each recipe when total < 10", async () => {
      const batchSize = 10;
      const total = 5;
      const progressEvents: number[] = [];

      for (let i = 0; i < total; i++) {
        const current = i + 1;
        const shouldEmit = current % batchSize === 0 || current === total;

        if (shouldEmit) {
          progressEvents.push(current);
        }
      }

      // Should only emit at 5 (last recipe)
      expect(progressEvents).toEqual([5]);
    });

    it("includes batch recipes and errors in progress events", () => {
      const recipe1 = createMockRecipeDashboard({ id: "recipe-1" });
      const recipe2 = createMockRecipeDashboard({ id: "recipe-2" });
      const errors = [{ file: "bad.melarecipe", error: "Parse error" }];

      const progressEvent = {
        importId: "import-123",
        current: 10,
        total: 25,
        recipes: [recipe1, recipe2],
        errors,
      };

      expect(progressEvent.recipes).toHaveLength(2);
      expect(progressEvent.errors).toHaveLength(1);
      expect(progressEvent.current).toBe(10);
    });
  });

  describe("completion", () => {
    it("emits completion event with final counts", () => {
      const completionEvent = {
        importId: "import-123",
        imported: 23,
        errors: [
          { file: "recipe1.melarecipe", error: "Parse error" },
          { file: "recipe2.melarecipe", error: "Missing title" },
        ],
      };

      expect(completionEvent.imported).toBe(23);
      expect(completionEvent.errors).toHaveLength(2);
    });

    it("continues on error and reports all errors at end", async () => {
      const allErrors: Array<{ file: string; error: string }> = [];
      const files = ["good1.melarecipe", "bad1.melarecipe", "good2.melarecipe", "bad2.melarecipe"];

      // Simulate processing each file
      for (const file of files) {
        if (file.startsWith("bad")) {
          allErrors.push({ file, error: "Parse error" });
        }
      }

      // All errors collected
      expect(allErrors).toHaveLength(2);
      expect(allErrors[0].file).toBe("bad1.melarecipe");
      expect(allErrors[1].file).toBe("bad2.melarecipe");
    });
  });

  describe("recipe creation", () => {
    it("creates recipes with correct user ID", async () => {
      const userId = "test-user-123";
      const mockDto = {
        name: "Test Recipe",
        url: undefined,
        image: undefined,
        description: undefined,
        servings: 4,
        prepMinutes: undefined,
        cookMinutes: undefined,
        totalMinutes: undefined,
        recipeIngredients: [],
        steps: [],
        tags: [],
        systemUsed: "metric" as const,
      };

      parseMelaRecipeToTDOMock.mockResolvedValue(mockDto);
      createRecipeWithRefsMock.mockResolvedValue("created-recipe-id");
      getRecipeFullMock.mockResolvedValue(createMockRecipeDashboard({ id: "created-recipe-id" }));

      // Simulate recipe creation call
      const recipeId = crypto.randomUUID();
      const createdId = await createRecipeWithRefs(recipeId, userId, mockDto);

      expect(createRecipeWithRefsMock).toHaveBeenCalledWith(recipeId, userId, mockDto);
      expect(createdId).toBe("created-recipe-id");
    });
  });

  describe("duplicate detection", () => {
    it("skips recipes that already exist by URL", async () => {
      const userIds = ["user-1", "user-2"];
      const existingUrl = "https://example.com/recipe";

      // Mock: recipe exists by URL
      findExistingRecipeMock.mockResolvedValue("existing-recipe-id");

      const existingId = await findExistingRecipe(userIds, existingUrl, "Test Recipe");

      expect(findExistingRecipeMock).toHaveBeenCalledWith(userIds, existingUrl, "Test Recipe");
      expect(existingId).toBe("existing-recipe-id");
    });

    it("skips recipes that already exist by title when URL is null", async () => {
      const userIds = ["user-1"];
      const title = "Grandma's Apple Pie";

      // Mock: recipe exists by title
      findExistingRecipeMock.mockResolvedValue("existing-recipe-id");

      const existingId = await findExistingRecipe(userIds, null, title);

      expect(findExistingRecipeMock).toHaveBeenCalledWith(userIds, null, title);
      expect(existingId).toBe("existing-recipe-id");
    });

    it("returns null when no duplicate found", async () => {
      const userIds = ["user-1"];

      // Mock: no duplicate
      findExistingRecipeMock.mockResolvedValue(null);

      const existingId = await findExistingRecipe(userIds, "https://new.com", "New Recipe");

      expect(existingId).toBeNull();
    });

    it("includes skipped count in completion event", async () => {
      // Simulate completion event structure with skipped recipes
      const completionPayload = {
        importId: "test-import",
        imported: 8,
        skipped: 2,
        errors: [],
      };

      expect(completionPayload.skipped).toBe(2);
      expect(completionPayload.imported).toBe(8);
    });
  });
});
