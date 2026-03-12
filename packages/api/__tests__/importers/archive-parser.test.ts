import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  ArchiveFormat,
  calculateBatchSize,
  getArchiveInfo,
} from "@norish/api/importers/archive-parser";

// @vitest-environment node

describe("Archive Parser", () => {
  describe("getArchiveInfo", () => {
    it("detects Mealie format (database.json present)", async () => {
      const zip = new JSZip();

      zip.file("database.json", JSON.stringify({ recipes: [{ id: "1" }, { id: "2" }] }));

      const { format, count } = await getArchiveInfo(zip);

      expect(format).toBe(ArchiveFormat.MEALIE);
      expect(count).toBe(2);
    });

    it("detects Mela format (.melarecipe files present)", async () => {
      const zip = new JSZip();

      zip.file("recipe1.melarecipe", JSON.stringify({ title: "Recipe 1" }));
      zip.file("recipe2.melarecipe", JSON.stringify({ title: "Recipe 2" }));

      const { format, count } = await getArchiveInfo(zip);

      expect(format).toBe(ArchiveFormat.MELA);
      expect(count).toBe(2);
    });

    it("prioritizes Mealie over Mela when both exist", async () => {
      const zip = new JSZip();

      zip.file("database.json", JSON.stringify({ recipes: [{ id: "1" }] }));
      zip.file("recipe.melarecipe", JSON.stringify({ title: "Recipe" }));

      const { format, count } = await getArchiveInfo(zip);

      expect(format).toBe(ArchiveFormat.MEALIE);
      expect(count).toBe(1);
    });

    it("returns UNKNOWN for empty archive", async () => {
      const zip = new JSZip();
      const { format, count } = await getArchiveInfo(zip);

      expect(format).toBe(ArchiveFormat.UNKNOWN);
      expect(count).toBe(0);
    });

    it("returns UNKNOWN for archive with unrelated files", async () => {
      const zip = new JSZip();

      zip.file("readme.txt", "Some text");
      zip.file("image.jpg", "fake image data");

      const { format, count } = await getArchiveInfo(zip);

      expect(format).toBe(ArchiveFormat.UNKNOWN);
      expect(count).toBe(0);
    });

    it("detects Mela with case-insensitive extension", async () => {
      const zip = new JSZip();

      zip.file("recipe.MELARECIPE", JSON.stringify({ title: "Recipe" }));

      const { format, count } = await getArchiveInfo(zip);

      expect(format).toBe(ArchiveFormat.MELA);
      expect(count).toBe(1);
    });

    it("detects Tandoor format (nested .zip files with recipe.json)", async () => {
      const nestedZip = new JSZip();

      nestedZip.file("recipe.json", JSON.stringify({ name: "Test Recipe", steps: [] }));

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("recipe_1.zip", nestedZipBuffer);

      const { format, count } = await getArchiveInfo(mainZip);

      expect(format).toBe(ArchiveFormat.TANDOOR);
      expect(count).toBe(1);
    });

    it("prioritizes Mealie over Tandoor when both exist", async () => {
      const nestedZip = new JSZip();

      nestedZip.file("recipe.json", JSON.stringify({ name: "Test Recipe", steps: [] }));

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("database.json", JSON.stringify({ recipes: [{ id: "1" }] }));
      mainZip.file("recipe_1.zip", nestedZipBuffer);

      const { format, count } = await getArchiveInfo(mainZip);

      expect(format).toBe(ArchiveFormat.MEALIE);
      expect(count).toBe(1);
    });

    it("returns UNKNOWN for nested zip without recipe.json", async () => {
      const nestedZip = new JSZip();

      nestedZip.file("wrong-file.txt", "not a recipe");

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("not_a_recipe.zip", nestedZipBuffer);

      const { format, count } = await getArchiveInfo(mainZip);

      expect(format).toBe(ArchiveFormat.UNKNOWN);
      expect(count).toBe(0);
    });

    it("detects Paprika format (.paprikarecipe files present)", async () => {
      const nestedZip = new JSZip();

      nestedZip.file("recipe.json", JSON.stringify({ name: "Test Recipe" }));

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("recipe_1.paprikarecipe", nestedZipBuffer);

      const { format, count } = await getArchiveInfo(mainZip);

      expect(format).toBe(ArchiveFormat.PAPRIKA);
      expect(count).toBe(1);
    });

    it("detects Paprika with case-insensitive extension", async () => {
      const nestedZip = new JSZip();

      nestedZip.file("recipe.json", JSON.stringify({ name: "Test Recipe" }));

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("recipe.PAPRIKARECIPE", nestedZipBuffer);

      const { format, count } = await getArchiveInfo(mainZip);

      expect(format).toBe(ArchiveFormat.PAPRIKA);
      expect(count).toBe(1);
    });

    it("prioritizes Mealie over Paprika when both exist", async () => {
      const nestedZip = new JSZip();

      nestedZip.file("recipe.json", JSON.stringify({ name: "Test Recipe" }));

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("database.json", JSON.stringify({ recipes: [{ id: "1" }] }));
      mainZip.file("recipe_1.paprikarecipe", nestedZipBuffer);

      const { format, count } = await getArchiveInfo(mainZip);

      expect(format).toBe(ArchiveFormat.MEALIE);
      expect(count).toBe(1);
    });

    it("prioritizes Mela over Paprika when both exist", async () => {
      const nestedZip = new JSZip();

      nestedZip.file("recipe.json", JSON.stringify({ name: "Test Recipe" }));

      const nestedZipBuffer = await nestedZip.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("recipe.melarecipe", JSON.stringify({ title: "Recipe" }));
      mainZip.file("recipe_1.paprikarecipe", nestedZipBuffer);

      const { format, count } = await getArchiveInfo(mainZip);

      expect(format).toBe(ArchiveFormat.MELA);
      expect(count).toBe(1);
    });

    it("prioritizes Paprika over Tandoor when both exist", async () => {
      const paprikaNestedZip = new JSZip();

      paprikaNestedZip.file("recipe.json", JSON.stringify({ name: "Paprika Recipe" }));

      const paprikaNestedZipBuffer = await paprikaNestedZip.generateAsync({ type: "nodebuffer" });

      const tandoorNestedZip = new JSZip();

      tandoorNestedZip.file("recipe.json", JSON.stringify({ name: "Tandoor Recipe", steps: [] }));

      const tandoorNestedZipBuffer = await tandoorNestedZip.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("recipe_1.paprikarecipe", paprikaNestedZipBuffer);
      mainZip.file("recipe_1.zip", tandoorNestedZipBuffer);

      const { format, count } = await getArchiveInfo(mainZip);

      expect(format).toBe(ArchiveFormat.PAPRIKA);
      expect(count).toBe(1);
    });

    it("counts multiple Tandoor recipes correctly", async () => {
      const nestedZip1 = new JSZip();

      nestedZip1.file("recipe.json", JSON.stringify({ name: "Recipe 1", steps: [] }));

      const nestedZip2 = new JSZip();

      nestedZip2.file("recipe.json", JSON.stringify({ name: "Recipe 2", steps: [] }));

      const nestedZip3 = new JSZip();

      nestedZip3.file("recipe.json", JSON.stringify({ name: "Recipe 3", steps: [] }));

      const buffer1 = await nestedZip1.generateAsync({ type: "nodebuffer" });
      const buffer2 = await nestedZip2.generateAsync({ type: "nodebuffer" });
      const buffer3 = await nestedZip3.generateAsync({ type: "nodebuffer" });

      const mainZip = new JSZip();

      mainZip.file("recipe_1.zip", buffer1);
      mainZip.file("recipe_2.zip", buffer2);
      mainZip.file("recipe_3.zip", buffer3);

      const { format, count } = await getArchiveInfo(mainZip);

      expect(format).toBe(ArchiveFormat.TANDOOR);
      expect(count).toBe(3);
    });
  });

  describe("calculateBatchSize", () => {
    it("returns 10 for <100 recipes", () => {
      expect(calculateBatchSize(1)).toBe(10);
      expect(calculateBatchSize(50)).toBe(10);
      expect(calculateBatchSize(99)).toBe(10);
    });

    it("returns 25 for 100-500 recipes", () => {
      expect(calculateBatchSize(100)).toBe(25);
      expect(calculateBatchSize(250)).toBe(25);
      expect(calculateBatchSize(500)).toBe(25);
    });

    it("returns 50 for >500 recipes", () => {
      expect(calculateBatchSize(501)).toBe(50);
      expect(calculateBatchSize(1000)).toBe(50);
      expect(calculateBatchSize(5000)).toBe(50);
    });

    it("handles edge cases", () => {
      expect(calculateBatchSize(0)).toBe(10);
      expect(calculateBatchSize(100)).toBe(25);
      expect(calculateBatchSize(500)).toBe(25);
      expect(calculateBatchSize(501)).toBe(50);
    });
  });
});
