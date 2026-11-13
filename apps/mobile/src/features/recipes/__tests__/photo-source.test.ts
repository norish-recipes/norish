import { photoSources, settlePhotoPick } from "@/features/recipes/utils/photo-source";
import { describe, expect, it } from "vitest";

describe("photoSources", () => {
  it("offers the camera only when the device has one", () => {
    expect(photoSources(true)).toEqual(["library", "camera"]);
    expect(photoSources(false)).toEqual(["library"]);
  });
});

describe("settlePhotoPick", () => {
  it("hands over the chosen files", async () => {
    const result = await settlePhotoPick(async () => ({
      canceled: false,
      assets: [{ uri: "file:///a.jpg" }, { uri: "file:///b.jpg" }],
    }));

    expect(result).toEqual({
      kind: "picked",
      assets: [{ uri: "file:///a.jpg" }, { uri: "file:///b.jpg" }],
    });
  });

  it("treats a cancelled pick as nothing to do", async () => {
    expect(await settlePhotoPick(async () => ({ canceled: true, assets: null }))).toEqual({
      kind: "cancelled",
    });
  });

  it("treats a pick with no files as nothing to do", async () => {
    expect(await settlePhotoPick(async () => ({ canceled: false, assets: [] }))).toEqual({
      kind: "cancelled",
    });
  });

  it("treats a rejected pick as a failure", async () => {
    expect(
      await settlePhotoPick(async () => {
        throw new Error("no camera");
      })
    ).toEqual({ kind: "failed" });
  });
});
