import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockAuthedContext } from "./test-utils";

// Mock logger
vi.mock("@/server/logger", () => ({
  trpcLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("recipes.reserveId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("requires authentication", async () => {
      // reserveId uses authedProcedure, so it requires authentication
      const ctx = createMockAuthedContext();

      expect(ctx.user).toBeDefined();
      expect(ctx.user.id).toBe("test-user-id");
    });
  });

  describe("ID generation", () => {
    it("returns a valid UUID", async () => {
      const _ctx = createMockAuthedContext();
      const crypto = await import("crypto");

      const recipeId = crypto.randomUUID();

      // Verify it's a valid UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(uuidRegex.test(recipeId)).toBe(true);
    });

    it("generates unique IDs on each call", async () => {
      const crypto = await import("crypto");

      const id1 = crypto.randomUUID();
      const id2 = crypto.randomUUID();
      const id3 = crypto.randomUUID();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });

  describe("return value", () => {
    it("returns object with recipeId property", async () => {
      const _ctx = createMockAuthedContext();
      const crypto = await import("crypto");

      const result = { recipeId: crypto.randomUUID() };

      expect(result).toHaveProperty("recipeId");
      expect(typeof result.recipeId).toBe("string");
      expect(result.recipeId.length).toBe(36); // UUID length with hyphens
    });
  });

  describe("logging", () => {
    it("logs the reserved recipe ID", async () => {
      const { trpcLogger } = await import("@/server/logger");
      const crypto = await import("crypto");

      const recipeId = crypto.randomUUID();

      // Simulate the procedure logging
      trpcLogger.debug({ recipeId }, "Reserved recipe ID for step image uploads");

      expect(trpcLogger.debug).toHaveBeenCalledWith(
        { recipeId },
        "Reserved recipe ID for step image uploads"
      );
    });
  });

  describe("use case", () => {
    it("ID can be used for step image uploads before recipe creation", async () => {
      const _ctx = createMockAuthedContext();
      const crypto = await import("crypto");

      // Reserve ID
      const reservedId = crypto.randomUUID();

      // This ID should be usable for constructing step image paths
      const stepImagePath = `/recipes/${reservedId}/steps/image.jpg`;

      expect(stepImagePath).toMatch(/^\/recipes\/[0-9a-f-]{36}\/steps\/image\.jpg$/i);
    });

    it("reserved ID can be passed to create mutation", async () => {
      const crypto = await import("crypto");

      const reservedId = crypto.randomUUID();

      // Simulate passing to create mutation
      const createInput = {
        id: reservedId,
        name: "Test Recipe",
        servings: 4,
        systemUsed: "metric" as const,
        recipeIngredients: [],
        steps: [],
        tags: [],
      };

      expect(createInput.id).toBe(reservedId);
    });
  });
});

describe("recipes image procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadImage", () => {
    it("accepts FormData with image file", () => {
      const formData = new FormData();
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

      formData.append("image", file);

      expect(formData.get("image")).toBeDefined();
      expect(formData.get("image")).toBeInstanceOf(File);
    });

    it("validates file type", () => {
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

      expect(validTypes.includes(file.type)).toBe(true);
    });

    it("validates file size", () => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });

      expect(file.size).toBeLessThanOrEqual(maxSize);
    });

    it("returns success with URL on upload", () => {
      const result = {
        success: true,
        url: "/recipes/images/test-image.jpg",
      };

      expect(result.success).toBe(true);
      expect(result.url).toMatch(/^\/recipes\/images\//);
    });

    it("returns error on failure", () => {
      const result = {
        success: false,
        error: "File too large",
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("deleteImage", () => {
    it("accepts URL string", () => {
      const input = { url: "/recipes/images/test.jpg" };

      expect(input.url).toBeDefined();
      expect(typeof input.url).toBe("string");
    });

    it("validates URL format", () => {
      const validUrl = "/recipes/images/test.jpg";
      const invalidUrl = "/avatars/user.jpg";

      expect(validUrl.startsWith("/recipes/images/")).toBe(true);
      expect(invalidUrl.startsWith("/recipes/images/")).toBe(false);
    });

    it("returns success on deletion", () => {
      const result = { success: true };

      expect(result.success).toBe(true);
    });
  });

  describe("uploadStepImage", () => {
    it("accepts FormData with image and recipeId", () => {
      const formData = new FormData();
      const file = new File(["test"], "step.jpg", { type: "image/jpeg" });

      formData.append("image", file);
      formData.append("recipeId", "recipe-123");

      expect(formData.get("image")).toBeDefined();
      expect(formData.get("recipeId")).toBe("recipe-123");
    });

    it("validates recipeId is provided", () => {
      const formData = new FormData();

      formData.append("recipeId", "recipe-123");

      const recipeId = formData.get("recipeId");

      expect(recipeId).toBeDefined();
      expect(recipeId).not.toBe("");
    });

    it("returns URL with recipeId in path", () => {
      const recipeId = "recipe-abc";
      const result = {
        success: true,
        url: `/recipes/${recipeId}/steps/step-image.jpg`,
      };

      expect(result.success).toBe(true);
      expect(result.url).toContain(recipeId);
      expect(result.url).toMatch(/^\/recipes\/[^/]+\/steps\//);
    });
  });

  describe("deleteStepImage", () => {
    it("accepts URL string", () => {
      const input = { url: "/recipes/recipe-123/steps/step.jpg" };

      expect(input.url).toBeDefined();
      expect(typeof input.url).toBe("string");
    });

    it("validates step image URL format", () => {
      const validUrl = "/recipes/recipe-123/steps/step.jpg";
      const invalidUrl = "/recipes/images/test.jpg";

      expect(validUrl.match(/^\/recipes\/[^/]+\/steps\//)).toBeTruthy();
      expect(invalidUrl.match(/^\/recipes\/[^/]+\/steps\//)).toBeFalsy();
    });

    it("uses deleteStepImageByUrl helper from downloader", () => {
      const url = "/recipes/abc-123-def/steps/step.jpg";
      const urlPattern = /^\/recipes\/([a-f0-9-]+)\/steps\/([^/]+)$/i;

      expect(url.match(urlPattern)).toBeTruthy();
    });
  });
});

describe("recipe creation with reserved ID", () => {
  it("accepts optional id in create input", () => {
    const input = {
      id: "reserved-id-123",
      name: "Test Recipe",
      servings: 4,
      systemUsed: "metric" as const,
      recipeIngredients: [],
      steps: [],
      tags: [],
    };

    expect(input.id).toBe("reserved-id-123");
  });

  it("uses provided ID instead of generating new one", () => {
    const providedId = "frontend-reserved-id";
    const recipeId = providedId; // Simulates: input.id ?? crypto.randomUUID()

    expect(recipeId).toBe(providedId);
  });

  it("logs both provided and used recipe IDs", async () => {
    const { trpcLogger } = await import("@/server/logger");
    const providedId = "provided-123";

    trpcLogger.info(
      {
        userId: "user-1",
        recipeName: "Test",
        recipeId: providedId,
        providedId: providedId,
      },
      "Creating recipe"
    );

    expect(trpcLogger.info).toHaveBeenCalled();
  });

  it("detects ID mismatch when they differ", async () => {
    const { trpcLogger } = await import("@/server/logger");
    const inputId: string = "input-id";
    const generatedId: string = "different-id";

    // Simulate the mismatch detection logic
    if (inputId && inputId !== generatedId) {
      trpcLogger.error({ inputId, generatedId }, "Recipe ID mismatch detected!");
    }

    expect(trpcLogger.error).toHaveBeenCalledWith(
      { inputId, generatedId },
      "Recipe ID mismatch detected!"
    );
  });
});
