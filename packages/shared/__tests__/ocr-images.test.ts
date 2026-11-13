import { describe, expect, it } from "vitest";

import { MAX_OCR_FILES } from "@norish/shared/contracts/uploads";
import { fitOcrCap, refuseOcrImage } from "@norish/shared/lib/ocr-images";

const MB = 1024 * 1024;

describe("refuseOcrImage", () => {
  it("takes JPEG, PNG and WebP up to the size limit", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(refuseOcrImage({ type, size: 10 * MB }, 10 * MB)).toBeNull();
    }
  });

  it("refuses another type before looking at its size", () => {
    expect(refuseOcrImage({ type: "image/heic", size: 20 * MB }, 10 * MB)).toBe("type");
    expect(refuseOcrImage({ type: "application/pdf", size: 1 }, 10 * MB)).toBe("type");
  });

  it("refuses an image over the size limit", () => {
    expect(refuseOcrImage({ type: "image/png", size: 10 * MB + 1 }, 10 * MB)).toBe("size");
  });
});

describe("fitOcrCap", () => {
  it("keeps everything that fits", () => {
    expect(fitOcrCap(2, ["a", "b"])).toEqual({ kept: ["a", "b"], dropped: [] });
  });

  it("keeps the first ones up to the cap and drops the rest", () => {
    expect(fitOcrCap(MAX_OCR_FILES - 1, ["a", "b", "c"])).toEqual({
      kept: ["a"],
      dropped: ["b", "c"],
    });
  });

  it("keeps none once the cap is reached", () => {
    expect(fitOcrCap(MAX_OCR_FILES, ["a"])).toEqual({ kept: [], dropped: ["a"] });
    expect(fitOcrCap(MAX_OCR_FILES + 2, ["a"])).toEqual({ kept: [], dropped: ["a"] });
  });
});
