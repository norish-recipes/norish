// @vitest-environment node
/**
 * Writing a Generated Image through the gallery plan: the picture takes the
 * primary slot, every Source Image keeps its row and its place after it, and
 * only files nothing references any more are released (ADR-0040).
 */
import { describe, expect, it } from "vitest";

import type { GalleryImageRecord } from "@norish/shared/lib/recipe-generated-image";
import { planGeneratedImageReplacement } from "@norish/shared/lib/recipe-generated-image";

const DRAWN = "/recipes/r/drawn.jpg";

function row(
  id: string,
  image: string,
  order: number,
  generated = false,
  createdAt = "2026-01-01T00:00:00Z"
): GalleryImageRecord {
  return { id, image, order: String(order), generated, createdAt };
}

describe("planGeneratedImageReplacement", () => {
  it("keeps the Source Image that held the primary slot and moves it behind the new image", () => {
    const plan = planGeneratedImageReplacement(
      [row("photo", "/recipes/r/photo.jpg", 0), row("second", "/recipes/r/second.jpg", 1)],
      DRAWN
    );

    expect(plan.deleteImageIds).toEqual([]);
    expect(plan.reorder).toEqual([
      { id: "photo", order: 1 },
      { id: "second", order: 2 },
    ]);
    expect(plan.sourceFromScalar).toBeNull();
    // Nothing is released: both photographs keep their rows and files.
    expect(plan.replacedImageUrls).toEqual([]);
  });

  it("replaces a previous Generated Image and releases only its file", () => {
    const plan = planGeneratedImageReplacement(
      [row("drawn", "/recipes/r/old-drawn.jpg", 0, true), row("photo", "/recipes/r/photo.jpg", 1)],
      DRAWN
    );

    expect(plan.deleteImageIds).toEqual(["drawn"]);
    // The photograph is already at order 1, so it needs no rewrite.
    expect(plan.reorder).toEqual([]);
    expect(plan.replacedImageUrls).toEqual(["/recipes/r/old-drawn.jpg"]);
  });

  it("sweeps a stray Generated Image while the Source Image survives", () => {
    const plan = planGeneratedImageReplacement(
      [row("photo", "/recipes/r/photo.jpg", 0), row("stray", "/recipes/r/stray.jpg", 1, true)],
      DRAWN
    );

    expect(plan.deleteImageIds).toEqual(["stray"]);
    expect(plan.reorder).toEqual([{ id: "photo", order: 1 }]);
    expect(plan.replacedImageUrls).toEqual(["/recipes/r/stray.jpg"]);
  });

  it("recovers a photograph that only the deprecated scalar stores", () => {
    const plan = planGeneratedImageReplacement([], DRAWN, "/recipes/r/legacy.jpg");

    expect(plan.deleteImageIds).toEqual([]);
    expect(plan.reorder).toEqual([]);
    expect(plan.sourceFromScalar).toEqual({ image: "/recipes/r/legacy.jpg", order: 1 });
    // The recovered row still references the file, so nothing is released.
    expect(plan.replacedImageUrls).toEqual([]);
  });

  it("does not recover a scalar the gallery already carries", () => {
    const plan = planGeneratedImageReplacement(
      [row("photo", "/recipes/r/photo.jpg", 0)],
      DRAWN,
      "/recipes/r/photo.jpg"
    );

    expect(plan.sourceFromScalar).toBeNull();
    expect(plan.reorder).toEqual([{ id: "photo", order: 1 }]);
    expect(plan.replacedImageUrls).toEqual([]);
  });

  it("keeps a distinct scalar when the Source Image cap is already full", () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      row(`source-${index}`, `/recipes/r/source-${index}.jpg`, index)
    );

    const plan = planGeneratedImageReplacement(rows, DRAWN, "/recipes/r/legacy.jpg");

    // The gallery holds ten Source Images already. The scalar stays as the
    // record and its file is not released, so the write never makes a 12th row.
    expect(plan.sourceFromScalar).toBeNull();
    expect(plan.keepScalar).toBe(true);
    expect(plan.replacedImageUrls).toEqual([]);
  });

  it("recovers a distinct scalar into the last free Source Image slot", () => {
    const rows = Array.from({ length: 9 }, (_, index) =>
      row(`source-${index}`, `/recipes/r/source-${index}.jpg`, index)
    );

    const plan = planGeneratedImageReplacement(rows, DRAWN, "/recipes/r/legacy.jpg");

    expect(plan.sourceFromScalar).toEqual({ image: "/recipes/r/legacy.jpg", order: 10 });
    expect(plan.keepScalar).toBe(false);
    expect(plan.replacedImageUrls).toEqual([]);
  });

  it("does not keep a scalar that a Source Image row already carries", () => {
    const plan = planGeneratedImageReplacement(
      [row("photo", "/recipes/r/photo.jpg", 0)],
      DRAWN,
      "/recipes/r/photo.jpg"
    );

    expect(plan.sourceFromScalar).toBeNull();
    expect(plan.keepScalar).toBe(false);
  });

  it("releases a scalar that named the Generated Image it replaces", () => {
    const plan = planGeneratedImageReplacement(
      [row("drawn", "/recipes/r/old-drawn.jpg", 0, true)],
      DRAWN,
      "/recipes/r/old-drawn.jpg"
    );

    expect(plan.sourceFromScalar).toBeNull();
    expect(plan.replacedImageUrls).toEqual(["/recipes/r/old-drawn.jpg"]);
  });

  it("never releases a URL a surviving row still references", () => {
    const shared = "/recipes/r/shared.jpg";
    const plan = planGeneratedImageReplacement(
      [row("first", shared, 0), row("second", shared, 1)],
      DRAWN,
      shared
    );

    expect(plan.deleteImageIds).toEqual([]);
    expect(plan.replacedImageUrls).toEqual([]);
  });

  it("never releases the file it just wrote", () => {
    const plan = planGeneratedImageReplacement([row("drawn", DRAWN, 0, true)], DRAWN);

    expect(plan.deleteImageIds).toEqual(["drawn"]);
    expect(plan.replacedImageUrls).toEqual([]);
  });

  it("renumbers a gallery with gaps without putting an appended image first", () => {
    const plan = planGeneratedImageReplacement(
      [row("late", "/recipes/r/late.jpg", 7), row("early", "/recipes/r/early.jpg", 3)],
      DRAWN
    );

    // Reader order is order 3 then 7; the new image is 0 and they become 1, 2.
    expect(plan.reorder).toEqual([
      { id: "early", order: 1 },
      { id: "late", order: 2 },
    ]);
  });

  it("orders tied rows by creation time, matching the reader's tiebreak", () => {
    const plan = planGeneratedImageReplacement(
      [
        row("newer", "/recipes/r/newer.jpg", 0, false, "2026-02-01T00:00:00Z"),
        row("older", "/recipes/r/older.jpg", 0, false, "2026-01-01T00:00:00Z"),
      ],
      DRAWN
    );

    expect(plan.reorder).toEqual([
      { id: "older", order: 1 },
      { id: "newer", order: 2 },
    ]);
  });

  it("writes into an empty gallery with nothing to delete or release", () => {
    const plan = planGeneratedImageReplacement([], DRAWN);

    expect(plan).toEqual({
      deleteImageIds: [],
      reorder: [],
      sourceFromScalar: null,
      keepScalar: false,
      replacedImageUrls: [],
    });
  });
});
