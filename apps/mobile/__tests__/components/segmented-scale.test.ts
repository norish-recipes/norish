import { sharedLabelScale } from "@/components/segmented-scale";
import { describe, expect, it } from "vitest";

const segments = [{ value: "tags" }, { value: "ingredients" }] as const;

describe("sharedLabelScale", () => {
  it("keeps full size while every label fits", () => {
    expect(
      sharedLabelScale(
        segments,
        { tags: 30, ingredients: 60 },
        { tags: { x: 35, width: 30 }, ingredients: { x: 20, width: 60 } },
        { tags: { width: 100 }, ingredients: { width: 100 } }
      )
    ).toBe(1);
  });

  it("shrinks every label to the size the tightest one needs", () => {
    // 100 wide less 16 inset leaves 84 for an 105-wide label: 0.8 for all.
    expect(
      sharedLabelScale(
        segments,
        { tags: 30, ingredients: 105 },
        { tags: { x: 35, width: 30 }, ingredients: { x: 8, width: 84 } },
        { tags: { width: 100 }, ingredients: { width: 100 } }
      )
    ).toBeCloseTo(0.8);
  });

  it("leaves out the room an icon takes, at whatever size the label is drawn", () => {
    // A 26-wide icon and gap leave 100 - 16 - 26 = 58 for a 116-wide label, drawn full or half size.
    const scale = sharedLabelScale(
      [{ value: "list" }],
      { list: 116 },
      { list: { x: 8 + 26, width: 58 } },
      { list: { width: 100 } }
    );

    expect(scale).toBeCloseTo(0.5);
    expect(
      sharedLabelScale(
        [{ value: "list" }],
        { list: 116 },
        { list: { x: (100 - 26 - 29) / 2 + 26, width: 29 } },
        { list: { width: 100 } }
      )
    ).toBeCloseTo(0.5);
  });
});
