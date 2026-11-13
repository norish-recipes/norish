import { coverSources, settleCoverPick } from "@/features/recipes/utils/cover-source";
import { describe, expect, it } from "vitest";

describe("coverSources", () => {
  it("offers the camera only when the device has one", () => {
    expect(coverSources(true)).toEqual(["library", "camera"]);
    expect(coverSources(false)).toEqual(["library"]);
  });
});

describe("settleCoverPick", () => {
  it("hands over the chosen file", async () => {
    const result = await settleCoverPick(async () => ({
      canceled: false,
      assets: [{ uri: "file:///a.jpg" }],
    }));

    expect(result).toEqual({ kind: "picked", uri: "file:///a.jpg" });
  });

  it("treats a cancelled pick as nothing to do", async () => {
    expect(await settleCoverPick(async () => ({ canceled: true, assets: null }))).toEqual({
      kind: "cancelled",
    });
  });

  it("treats a rejected pick as a failure", async () => {
    expect(
      await settleCoverPick(async () => {
        throw new Error("no camera");
      })
    ).toEqual({ kind: "failed" });
  });
});
