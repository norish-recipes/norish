import { FIT_SHEET_OPTIONS, SHEET_OPTIONS } from "@/components/sheet-options";
import { describe, expect, it } from "vitest";

describe("sheet route options", () => {
  it("opens a resizable sheet at 62% with a grabber and expands to full on scroll", () => {
    expect(SHEET_OPTIONS).toMatchObject({
      presentation: "formSheet",
      headerShown: false,
      sheetGrabberVisible: true,
      sheetAllowedDetents: [0.62, 1],
      sheetInitialDetentIndex: 0,
      sheetExpandsWhenScrolledToEdge: true,
    });
  });

  it("lets a resizable sheet's content fill it on the glass", () => {
    expect(SHEET_OPTIONS.contentStyle).toEqual({ backgroundColor: "transparent", bottom: 0 });
  });

  it("sizes a fitting sheet to its content, without a grabber or a second height", () => {
    expect(FIT_SHEET_OPTIONS).toMatchObject({
      presentation: "formSheet",
      headerShown: false,
      sheetGrabberVisible: false,
      sheetAllowedDetents: "fitToContents",
      contentStyle: { backgroundColor: "transparent" },
    });
    expect(FIT_SHEET_OPTIONS.contentStyle).not.toHaveProperty("bottom");
  });
});
