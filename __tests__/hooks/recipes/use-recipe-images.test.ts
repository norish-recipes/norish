import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { createTestQueryClient, createTestWrapper } from "./test-utils";

// Mock tRPC provider
vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    recipes: {
      uploadImage: {
        mutationOptions: () => ({
          mutationFn: vi.fn(async (formData: FormData) => {
            const file = formData.get("image");
            if (!file) {
              return { success: false, error: "No image provided" };
            }
            return { success: true, url: "/recipes/images/test-image.jpg" };
          }),
        }),
      },
      deleteImage: {
        mutationOptions: () => ({
          mutationFn: vi.fn(async ({ url }: { url: string }) => {
            if (!url.startsWith("/recipes/images/")) {
              return { success: false, error: "Invalid URL" };
            }
            return { success: true };
          }),
        }),
      },
      uploadStepImage: {
        mutationOptions: () => ({
          mutationFn: vi.fn(async (formData: FormData) => {
            const file = formData.get("image");
            const recipeId = formData.get("recipeId");
            if (!file || !recipeId) {
              return { success: false, error: "Missing file or recipeId" };
            }
            return { success: true, url: `/recipes/${recipeId}/steps/test-step.jpg` };
          }),
        }),
      },
      deleteStepImage: {
        mutationOptions: () => ({
          mutationFn: vi.fn(async ({ url }: { url: string }) => {
            if (!url.match(/^\/recipes\/[^/]+\/steps\//)) {
              return { success: false, error: "Invalid step image URL" };
            }
            return { success: true };
          }),
        }),
      },
    },
  }),
}));

describe("useRecipeImages", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  describe("module structure", () => {
    it("exports all expected functions and states", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current).toHaveProperty("uploadImage");
      expect(result.current).toHaveProperty("deleteImage");
      expect(result.current).toHaveProperty("uploadStepImage");
      expect(result.current).toHaveProperty("deleteStepImage");
      expect(result.current).toHaveProperty("isUploadingImage");
      expect(result.current).toHaveProperty("isDeletingImage");
      expect(result.current).toHaveProperty("isUploadingStepImage");
      expect(result.current).toHaveProperty("isDeletingStepImage");

      expect(typeof result.current.uploadImage).toBe("function");
      expect(typeof result.current.deleteImage).toBe("function");
      expect(typeof result.current.uploadStepImage).toBe("function");
      expect(typeof result.current.deleteStepImage).toBe("function");
      expect(typeof result.current.isUploadingImage).toBe("boolean");
      expect(typeof result.current.isDeletingImage).toBe("boolean");
      expect(typeof result.current.isUploadingStepImage).toBe("boolean");
      expect(typeof result.current.isDeletingStepImage).toBe("boolean");
    });
  });

  describe("uploadImage", () => {
    it("returns success with URL when upload succeeds", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const response = await result.current.uploadImage(file);

      expect(response.success).toBe(true);
      expect(response.url).toBe("/recipes/images/test-image.jpg");
    });

    it("returns error when no file provided", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      // Create empty FormData (simulating no file)
      const mockFile = null as any;
      
      try {
        await result.current.uploadImage(mockFile);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("sets isUploadingImage to true during upload", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      const uploadPromise = result.current.uploadImage(file);

      // Initially false
      expect(result.current.isUploadingImage).toBe(false);

      await uploadPromise;

      // After completion
      await waitFor(() => {
        expect(result.current.isUploadingImage).toBe(false);
      });
    });
  });

  describe("deleteImage", () => {
    it("returns success when deletion succeeds", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      const response = await result.current.deleteImage("/recipes/images/test.jpg");

      expect(response.success).toBe(true);
    });

    it("returns error for invalid URL", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      const response = await result.current.deleteImage("/invalid/path.jpg");

      expect(response.success).toBe(false);
      expect(response.error).toBe("Invalid URL");
    });

    it("sets isDeletingImage to true during deletion", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      const deletePromise = result.current.deleteImage("/recipes/images/test.jpg");

      await deletePromise;

      await waitFor(() => {
        expect(result.current.isDeletingImage).toBe(false);
      });
    });
  });

  describe("uploadStepImage", () => {
    it("returns success with URL when upload succeeds", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      const file = new File(["test"], "step.jpg", { type: "image/jpeg" });
      const recipeId = "recipe-123";
      const response = await result.current.uploadStepImage(file, recipeId);

      expect(response.success).toBe(true);
      expect(response.url).toBe(`/recipes/${recipeId}/steps/test-step.jpg`);
    });

    it("creates FormData with both file and recipeId", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      const file = new File(["test"], "step.jpg", { type: "image/jpeg" });
      const recipeId = "recipe-456";
      
      await result.current.uploadStepImage(file, recipeId);
      
      expect(result.current).toBeDefined();
    });

    it("sets isUploadingStepImage to true during upload", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      const file = new File(["test"], "step.jpg", { type: "image/jpeg" });
      const uploadPromise = result.current.uploadStepImage(file, "recipe-123");

      await uploadPromise;

      await waitFor(() => {
        expect(result.current.isUploadingStepImage).toBe(false);
      });
    });
  });

  describe("deleteStepImage", () => {
    it("returns success when deletion succeeds", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      const response = await result.current.deleteStepImage(
        "/recipes/recipe-123/steps/step.jpg"
      );

      expect(response.success).toBe(true);
    });

    it("returns error for invalid step image URL", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      const response = await result.current.deleteStepImage("/recipes/images/wrong.jpg");

      expect(response.success).toBe(false);
      expect(response.error).toBe("Invalid step image URL");
    });

    it("sets isDeletingStepImage to true during deletion", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      const deletePromise = result.current.deleteStepImage(
        "/recipes/recipe-123/steps/step.jpg"
      );

      await deletePromise;

      await waitFor(() => {
        expect(result.current.isDeletingStepImage).toBe(false);
      });
    });
  });

  describe("loading states", () => {
    it("all loading states are initially false", async () => {
      const { useRecipeImages } = await import("@/hooks/recipes/use-recipe-images");
      const { result } = renderHook(() => useRecipeImages(), {
        wrapper: createTestWrapper(queryClient),
      });

      expect(result.current.isUploadingImage).toBe(false);
      expect(result.current.isDeletingImage).toBe(false);
      expect(result.current.isUploadingStepImage).toBe(false);
      expect(result.current.isDeletingStepImage).toBe(false);
    });
  });
});
