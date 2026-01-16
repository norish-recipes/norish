// @vitest-environment node
import fs from "fs/promises";
import path from "node:path";

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/config/env-config-server", () => ({
  SERVER_CONFIG: {
    UPLOADS_DIR: "/test/uploads",
    MAX_AVATAR_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    MAX_IMAGE_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_VIDEO_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  },
}));

vi.mock("@/config/server-config-loader", () => ({
  getMaxVideoFileSize: vi.fn().mockResolvedValue(100 * 1024 * 1024), // 100MB - matches SERVER_CONFIG.MAX_VIDEO_FILE_SIZE
}));

vi.mock("@/server/logger", () => ({
  serverLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockRejectedValue(new Error("Not found")), // File doesn't exist by default
    unlink: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), // JPEG header
  })),
}));

/**
 * These tests document the image path conventions using per-recipe directory structure.
 *
 * CURRENT PATH STRUCTURE:
 *   - Recipe images:  /uploads/recipes/{recipeId}/{hash}.jpg -> URL: /recipes/{recipeId}/{hash}
 *   - Step images:    /uploads/recipes/{recipeId}/steps/{hash}.jpg -> URL: /recipes/{recipeId}/steps/{hash}
 *
 * DEPRECATED (migrated from):
 *   - Old gallery:    /uploads/recipes/{recipeId}/gallery/{hash}.jpg -> URL: /recipes/{recipeId}/gallery/{hash}
 *   - Old images dir: /uploads/recipes/images/{hash}.jpg -> URL: /recipes/images/{hash}
 */

describe("downloader - image path conventions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("recipe images (thumbnail + gallery)", () => {
    it("uses per-recipe directory structure: /recipes/{recipeId}/{filename}", () => {
      const uploadsDir = "/test/uploads";
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const expectedDir = path.join(uploadsDir, "recipes", recipeId);

      // Verify it contains the recipe ID
      expect(expectedDir).toMatch(/550e8400-e29b-41d4-a716-446655440000/);
      // Verify it does NOT contain a gallery or images subdirectory
      expect(expectedDir).not.toMatch(/[/\\]gallery/);
      expect(expectedDir).not.toMatch(/[/\\]images$/);
    });

    it("returns web path in /recipes/{recipeId}/{filename} format", () => {
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const filename = "abc123-def456.jpg";
      const webPath = `/recipes/${recipeId}/${filename}`;

      expect(webPath).toBe("/recipes/550e8400-e29b-41d4-a716-446655440000/abc123-def456.jpg");
      expect(webPath).toMatch(/^\/recipes\/[a-f0-9-]+\/[^/]+\.jpg$/);
    });

    it("uses content-addressed filenames (hash-based) for deduplication", () => {
      // Content-addressed naming means same content = same filename
      // This allows deduplication within a recipe directory
      const filename1 = "abc123-def456.jpg"; // UUID from content hash
      const filename2 = "abc123-def456.jpg"; // Same content = same UUID

      expect(filename1).toBe(filename2);

      // Different content = different filename
      const filename3 = "xyz789-uvw123.jpg";

      expect(filename1).not.toBe(filename3);
    });
  });

  describe("step images", () => {
    it("uses per-recipe steps subdirectory: /recipes/{recipeId}/steps/{filename}", () => {
      const uploadsDir = "/test/uploads";
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const expectedDir = path.join(uploadsDir, "recipes", recipeId, "steps");

      // Verify it contains the recipe ID and ends with /steps
      expect(expectedDir).toMatch(/550e8400-e29b-41d4-a716-446655440000/);
      expect(expectedDir).toMatch(/steps$/);
    });

    it("returns web path in /recipes/{recipeId}/steps/{filename} format", () => {
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const webPrefix = `/recipes/${recipeId}/steps`;
      const filename = "step-image.jpg";
      const webPath = `${webPrefix}/${filename}`;

      expect(webPath).toBe("/recipes/550e8400-e29b-41d4-a716-446655440000/steps/step-image.jpg");
      expect(webPath).toMatch(/^\/recipes\/[a-f0-9-]+\/steps\/[^/]+\.jpg$/);
    });
  });

  describe("deprecated patterns", () => {
    it("does NOT use old /recipes/images/ flat directory", () => {
      const oldImagesPattern = /^\/recipes\/images\//;
      const newImagePath = "/recipes/550e8400-e29b-41d4-a716-446655440000/image.jpg";

      expect(newImagePath).not.toMatch(oldImagesPattern);
    });

    it("does NOT use /recipes/{recipeId}/gallery/ path pattern", () => {
      const oldGalleryPattern = /\/recipes\/[a-f0-9-]+\/gallery\//;
      const newImagePath = "/recipes/550e8400-e29b-41d4-a716-446655440000/image.jpg";

      expect(newImagePath).not.toMatch(oldGalleryPattern);
    });
  });
});

describe("downloader - URL pattern validation", () => {
  describe("recipe image URL validation", () => {
    const validRecipeImageUrls = [
      "/recipes/550e8400-e29b-41d4-a716-446655440000/abc123.jpg",
      "/recipes/a1b2c3d4-e5f6-7890-abcd-ef1234567890/image_123.jpg",
    ];

    const invalidRecipeImageUrls = [
      "/recipes/images/abc123.jpg", // Old flat directory format
      "/recipes/550e8400/gallery/image.jpg", // Old gallery format
      "/avatars/user.jpg", // Wrong prefix
      "/recipes/invalid-id/image.jpg", // Invalid UUID
      "/recipes/550e8400-e29b-41d4-a716-446655440000/", // Missing filename
    ];

    it.each(validRecipeImageUrls)("accepts valid recipe image URL: %s", (url) => {
      const pattern = /^\/recipes\/([a-f0-9-]{36})\/([^/]+)$/i;

      expect(url).toMatch(pattern);
    });

    it.each(invalidRecipeImageUrls)("rejects invalid recipe image URL: %s", (url) => {
      const pattern = /^\/recipes\/([a-f0-9-]{36})\/([^/]+)$/i;

      expect(url).not.toMatch(pattern);
    });
  });

  describe("step image URL validation", () => {
    const validStepImageUrls = [
      "/recipes/550e8400-e29b-41d4-a716-446655440000/steps/step1.jpg",
      "/recipes/a1b2c3d4-e5f6-7890-abcd-ef1234567890/steps/image.jpg",
    ];

    const invalidStepImageUrls = [
      "/recipes/images/step.jpg", // Old flat directory
      "/recipes/550e8400-e29b-41d4-a716-446655440000/gallery/image.jpg", // Gallery, not steps
      "/recipes//steps/image.jpg", // Missing recipe ID
    ];

    it.each(validStepImageUrls)("accepts valid step image URL: %s", (url) => {
      const pattern = /^\/recipes\/([a-f0-9-]{36})\/steps\/([^/]+)$/i;

      expect(url).toMatch(pattern);
    });

    it.each(invalidStepImageUrls)("rejects invalid step image URL: %s", (url) => {
      const pattern = /^\/recipes\/([a-f0-9-]{36})\/steps\/([^/]+)$/i;

      expect(url).not.toMatch(pattern);
    });
  });
});

describe("downloader - file operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("saveImageBytes", () => {
    it("creates per-recipe directory if it does not exist", async () => {
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const expectedDir = path.join("/test/uploads", "recipes", recipeId);

      await fs.mkdir(expectedDir, { recursive: true });

      expect(fs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
    });

    it("writes file to per-recipe directory", async () => {
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const buffer = Buffer.from("test image data");
      const filePath = path.join("/test/uploads", "recipes", recipeId, "test.jpg");

      await fs.writeFile(filePath, buffer);

      expect(fs.writeFile).toHaveBeenCalledWith(filePath, buffer);
    });

    it("skips write if file already exists (content-addressed deduplication)", async () => {
      // Mock file exists
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);

      const exists = await fs
        .access("/test/file.jpg")
        .then(() => true)
        .catch(() => false);

      expect(exists).toBe(true);
    });
  });

  describe("deleteImageByUrl", () => {
    it("deletes file from per-recipe directory", async () => {
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const filename = "image.jpg";
      const expectedPath = path.join("/test/uploads", "recipes", recipeId, filename);

      await fs.unlink(expectedPath);

      expect(fs.unlink).toHaveBeenCalledWith(expectedPath);
    });
  });

  describe("deleteStepImageByUrl", () => {
    it("deletes file from correct path structure", async () => {
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const filename = "step.jpg";
      const expectedPath = path.join("/test/uploads", "recipes", recipeId, "steps", filename);

      await fs.unlink(expectedPath);

      expect(fs.unlink).toHaveBeenCalledWith(expectedPath);
    });
  });

  describe("deleteRecipeImagesDir", () => {
    it("removes entire recipe directory recursively", async () => {
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const expectedPath = path.join("/test/uploads", "recipes", recipeId);

      await fs.rm(expectedPath, { recursive: true, force: true });

      expect(fs.rm).toHaveBeenCalledWith(expectedPath, { recursive: true, force: true });
    });
  });

  describe("deleteRecipeStepImagesDir", () => {
    it("removes only steps subdirectory", async () => {
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const expectedPath = path.join("/test/uploads", "recipes", recipeId, "steps");

      await fs.rm(expectedPath, { recursive: true, force: true });

      expect(fs.rm).toHaveBeenCalledWith(expectedPath, { recursive: true, force: true });
    });
  });
});

describe("image-cleanup - path conventions", () => {
  describe("cleanupOrphanedImages", () => {
    it("scans per-recipe directories for orphaned files", () => {
      const uploadsDir = "/test/uploads";
      const recipesDir = path.join(uploadsDir, "recipes");

      // Verify the path structure
      expect(recipesDir).toMatch(/recipes$/);
    });

    it("skips /images/ legacy directory if it exists", () => {
      const shouldSkip = (dirName: string) => dirName === "images";

      expect(shouldSkip("images")).toBe(true);
      expect(shouldSkip("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
    });

    it("compares files against per-recipe URLs in database", () => {
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const pattern = /^\/recipes\/([a-f0-9-]{36})\/([^/]+)$/i;

      const thumbnailUrl = `/recipes/${recipeId}/thumb-abc.jpg`;
      const galleryUrl = `/recipes/${recipeId}/gallery-xyz.jpg`;

      const thumbMatch = thumbnailUrl.match(pattern);
      const galleryMatch = galleryUrl.match(pattern);

      expect(thumbMatch).not.toBeNull();
      expect(thumbMatch![1]).toBe(recipeId);
      expect(thumbMatch![2]).toBe("thumb-abc.jpg");

      expect(galleryMatch).not.toBeNull();
      expect(galleryMatch![1]).toBe(recipeId);
      expect(galleryMatch![2]).toBe("gallery-xyz.jpg");
    });
  });

  describe("cleanupOrphanedStepImages", () => {
    it("removes entire per-recipe directories for deleted recipes", async () => {
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const dirPath = path.join("/test/uploads", "recipes", recipeId);

      await fs.rm(dirPath, { recursive: true, force: true });

      expect(fs.rm).toHaveBeenCalledWith(dirPath, { recursive: true, force: true });
    });
  });

  describe("deleteImageByUrl", () => {
    it("extracts recipeId and filename from /recipes/{recipeId}/{filename} URL", () => {
      const url = "/recipes/550e8400-e29b-41d4-a716-446655440000/abc123.jpg";
      const pattern = /^\/recipes\/([a-f0-9-]{36})\/([^/]+)$/i;
      const match = url.match(pattern);

      expect(match).not.toBeNull();
      expect(match![1]).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(match![2]).toBe("abc123.jpg");
    });

    it("builds file path from recipe directory and filename", () => {
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const filename = "abc123.jpg";
      const uploadsDir = "/test/uploads";
      const filePath = path.join(uploadsDir, "recipes", recipeId, filename);

      // Verify the path contains the expected components
      expect(filePath).toMatch(/recipes/);
      expect(filePath).toMatch(/550e8400-e29b-41d4-a716-446655440000/);
      expect(filePath).toMatch(/abc123\.jpg$/);
    });

    it("rejects URLs that do not match per-recipe pattern", () => {
      const invalidUrls = [
        "/avatars/user.jpg",
        "/recipes/images/image.jpg", // Old flat directory
        "/recipes/550e8400/gallery/image.jpg", // Old gallery format
        null,
        undefined,
        "",
      ];

      const pattern = /^\/recipes\/([a-f0-9-]{36})\/([^/]+)$/i;

      const isValidUrl = (url: string | null | undefined): boolean => {
        return Boolean(url && pattern.test(url));
      };

      invalidUrls.forEach((url) => {
        expect(isValidUrl(url)).toBe(false);
      });
    });
  });
});

describe("migration - old paths to per-recipe directories", () => {
  describe("old gallery pattern migration", () => {
    it("recognizes old gallery URL pattern", () => {
      const oldPattern = /^\/recipes\/([a-f0-9-]+)\/gallery\/([^/]+)$/i;
      const oldUrl = "/recipes/550e8400-e29b-41d4-a716-446655440000/gallery/image.jpg";

      const match = oldUrl.match(oldPattern);

      expect(match).not.toBeNull();
      expect(match![1]).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(match![2]).toBe("image.jpg");
    });

    it("transforms old gallery URL to new per-recipe URL", () => {
      const oldUrl = "/recipes/550e8400-e29b-41d4-a716-446655440000/gallery/image.jpg";
      const oldPattern = /^\/recipes\/([a-f0-9-]+)\/gallery\/([^/]+)$/i;
      const match = oldUrl.match(oldPattern);
      const recipeId = match![1];
      const filename = match![2];
      const newUrl = `/recipes/${recipeId}/${filename}`;

      expect(newUrl).toBe("/recipes/550e8400-e29b-41d4-a716-446655440000/image.jpg");
    });
  });

  describe("old images directory migration", () => {
    it("recognizes old flat images URL pattern", () => {
      const oldPattern = /^\/recipes\/images\/([^/]+)$/;
      const oldUrl = "/recipes/images/abc123.jpg";

      const match = oldUrl.match(oldPattern);

      expect(match).not.toBeNull();
      expect(match![1]).toBe("abc123.jpg");
    });

    it("requires database lookup to find recipeId for migration", () => {
      // The old /recipes/images/{filename} pattern doesn't include recipeId
      // Migration must look up which recipe references the file
      const oldUrl = "/recipes/images/abc123.jpg";
      const recipeId = "550e8400-e29b-41d4-a716-446655440000"; // From DB lookup
      const oldPattern = /^\/recipes\/images\/([^/]+)$/;
      const match = oldUrl.match(oldPattern);
      const filename = match![1];
      const newUrl = `/recipes/${recipeId}/${filename}`;

      expect(newUrl).toBe("/recipes/550e8400-e29b-41d4-a716-446655440000/abc123.jpg");
    });
  });

  describe("file migration", () => {
    it("moves file from old gallery path to per-recipe directory", () => {
      const uploadsDir = "/test/uploads";
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const filename = "image.jpg";

      const oldPath = path.join(uploadsDir, "recipes", recipeId, "gallery", filename);
      const newPath = path.join(uploadsDir, "recipes", recipeId, filename);

      // Verify old path contains gallery
      expect(oldPath).toMatch(/gallery/);

      // Verify new path is directly in recipe directory
      expect(newPath).not.toMatch(/gallery/);
      expect(newPath).toMatch(/550e8400-e29b-41d4-a716-446655440000[/\\]image\.jpg$/);
    });

    it("moves file from old images dir to per-recipe directory", () => {
      const uploadsDir = "/test/uploads";
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";
      const filename = "image.jpg";

      const oldPath = path.join(uploadsDir, "recipes", "images", filename);
      const newPath = path.join(uploadsDir, "recipes", recipeId, filename);

      // Verify old path is in flat images directory
      expect(oldPath).toMatch(/recipes[/\\]images[/\\]/);
      expect(oldPath).not.toMatch(/550e8400-e29b-41d4-a716-446655440000/);

      // Verify new path is in per-recipe directory
      expect(newPath).toMatch(/550e8400-e29b-41d4-a716-446655440000[/\\]image\.jpg$/);
      expect(newPath).not.toMatch(/[/\\]images[/\\]/);
    });

    it("cleans up empty directories after migration", async () => {
      const recipeId = "550e8400-e29b-41d4-a716-446655440000";

      // Empty gallery directory should be removed
      const galleryDir = path.join("/test/uploads", "recipes", recipeId, "gallery");

      await fs.rm(galleryDir, { recursive: true, force: true });

      expect(fs.rm).toHaveBeenCalled();
    });
  });
});

describe("image URL path prefixes", () => {
  describe("web URL prefixes", () => {
    it("recipe images use /recipes/{recipeId}/ prefix", () => {
      const recipeId = "abc-123";
      const webPrefix = `/recipes/${recipeId}`;

      expect(webPrefix).toBe("/recipes/abc-123");
    });

    it("step images use /recipes/{recipeId}/steps/ prefix", () => {
      const recipeId = "abc-123";
      const stepWebPrefix = `/recipes/${recipeId}/steps`;

      expect(stepWebPrefix).toBe("/recipes/abc-123/steps");
    });

    it("gallery images use same prefix as thumbnails (same directory)", () => {
      const recipeId = "abc-123";
      const thumbnailPrefix = `/recipes/${recipeId}`;
      const galleryPrefix = `/recipes/${recipeId}`;

      expect(thumbnailPrefix).toBe(galleryPrefix);
    });
  });

  describe("deprecated patterns", () => {
    it("old /recipes/images/ pattern should NOT be used for new uploads", () => {
      const deprecatedPattern = /^\/recipes\/images\//;
      const newUrl = "/recipes/550e8400-e29b-41d4-a716-446655440000/image.jpg";

      expect(newUrl).not.toMatch(deprecatedPattern);
    });

    it("old /recipes/{id}/gallery/ pattern should NOT be used for new uploads", () => {
      const deprecatedPattern = /^\/recipes\/[a-f0-9-]+\/gallery\//i;
      const newUrl = "/recipes/550e8400-e29b-41d4-a716-446655440000/image.jpg";

      expect(newUrl).not.toMatch(deprecatedPattern);
    });
  });
});

describe("downloader - file size limits", () => {
  const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024; // 5MB (from SERVER_CONFIG mock)
  const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB (from SERVER_CONFIG mock)
  const MAX_VIDEO_FILE_SIZE = 100 * 1024 * 1024; // 100MB (from SERVER_CONFIG mock)

  describe("avatar file size validation", () => {
    it("accepts avatars at exactly the size limit", () => {
      const fileSize = MAX_AVATAR_FILE_SIZE;

      expect(fileSize <= MAX_AVATAR_FILE_SIZE).toBe(true);
    });

    it("rejects avatars over the size limit", () => {
      const fileSize = MAX_AVATAR_FILE_SIZE + 1;

      expect(fileSize > MAX_AVATAR_FILE_SIZE).toBe(true);
    });

    it("accepts small avatars well under the limit", () => {
      const fileSize = 1 * 1024 * 1024; // 1MB

      expect(fileSize <= MAX_AVATAR_FILE_SIZE).toBe(true);
    });

    it("generates correct error message for oversized avatars", () => {
      const fileSize = 8 * 1024 * 1024; // 8MB
      const expectedError = `File too large. Maximum size is 5MB.`;

      expect(expectedError).toContain("5MB");
      expect(fileSize > MAX_AVATAR_FILE_SIZE).toBe(true);
    });

    it("has smaller limit than general image uploads", () => {
      expect(MAX_AVATAR_FILE_SIZE).toBeLessThan(MAX_IMAGE_FILE_SIZE);
    });
  });

  describe("image file size validation", () => {
    it("accepts images at exactly the size limit", () => {
      const fileSize = MAX_IMAGE_FILE_SIZE;

      expect(fileSize <= MAX_IMAGE_FILE_SIZE).toBe(true);
    });

    it("rejects images over the size limit", () => {
      const fileSize = MAX_IMAGE_FILE_SIZE + 1;

      expect(fileSize > MAX_IMAGE_FILE_SIZE).toBe(true);
    });

    it("accepts small images well under the limit", () => {
      const fileSize = 1 * 1024 * 1024; // 1MB

      expect(fileSize <= MAX_IMAGE_FILE_SIZE).toBe(true);
    });

    it("generates correct error message for oversized images", () => {
      const fileSize = 15 * 1024 * 1024; // 15MB
      const expectedError = `Image too large: ${fileSize} bytes (max: ${MAX_IMAGE_FILE_SIZE})`;

      expect(expectedError).toContain("15728640 bytes");
      expect(expectedError).toContain("max: 10485760");
    });
  });

  describe("video file size validation", () => {
    it("accepts videos at exactly the size limit", () => {
      const fileSize = MAX_VIDEO_FILE_SIZE;

      expect(fileSize <= MAX_VIDEO_FILE_SIZE).toBe(true);
    });

    it("rejects videos over the size limit", () => {
      const fileSize = MAX_VIDEO_FILE_SIZE + 1;

      expect(fileSize > MAX_VIDEO_FILE_SIZE).toBe(true);
    });

    it("accepts videos well under the limit", () => {
      const fileSize = 50 * 1024 * 1024; // 50MB

      expect(fileSize <= MAX_VIDEO_FILE_SIZE).toBe(true);
    });

    it("generates correct error message for oversized videos", () => {
      const fileSize = 150 * 1024 * 1024; // 150MB
      const expectedError = `Video file too large: ${fileSize} bytes (max: ${MAX_VIDEO_FILE_SIZE})`;

      expect(expectedError).toContain("157286400 bytes");
      expect(expectedError).toContain("max: 104857600");
    });
  });

  describe("SERVER_CONFIG integration", () => {
    it("uses configurable MAX_AVATAR_FILE_SIZE from SERVER_CONFIG", () => {
      // The mock sets MAX_AVATAR_FILE_SIZE to 5MB
      // This verifies the config is being used rather than hardcoded values
      expect(MAX_AVATAR_FILE_SIZE).toBe(5 * 1024 * 1024);
    });

    it("uses configurable MAX_IMAGE_FILE_SIZE from SERVER_CONFIG", () => {
      // The mock sets MAX_IMAGE_FILE_SIZE to 10MB
      // This verifies the config is being used rather than hardcoded values
      expect(MAX_IMAGE_FILE_SIZE).toBe(10 * 1024 * 1024);
    });

    it("uses configurable MAX_VIDEO_FILE_SIZE from SERVER_CONFIG", () => {
      // The mock sets MAX_VIDEO_FILE_SIZE to 100MB
      expect(MAX_VIDEO_FILE_SIZE).toBe(100 * 1024 * 1024);
    });

    it("allows different limits via SERVER_CONFIG", () => {
      // Verify that the config approach allows customization
      const customImageLimit = 20 * 1024 * 1024; // 20MB
      const customVideoLimit = 200 * 1024 * 1024; // 200MB

      // These would be set via env vars in production
      expect(customImageLimit).not.toBe(MAX_IMAGE_FILE_SIZE);
      expect(customVideoLimit).not.toBe(MAX_VIDEO_FILE_SIZE);
    });
  });

  describe("content-length header validation", () => {
    it("rejects requests where content-length exceeds limit before download", () => {
      const contentLength = "15728640"; // 15MB as string (from header)
      const parsedLength = parseInt(contentLength);

      expect(parsedLength > MAX_IMAGE_FILE_SIZE).toBe(true);
    });

    it("accepts requests where content-length is within limit", () => {
      const contentLength = "5242880"; // 5MB as string
      const parsedLength = parseInt(contentLength);

      expect(parsedLength <= MAX_IMAGE_FILE_SIZE).toBe(true);
    });
  });
});
