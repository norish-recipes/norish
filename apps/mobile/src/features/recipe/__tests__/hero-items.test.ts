import { describe, expect, it } from "vitest";

import { heroItems } from "../utils/hero-items";

describe("heroItems", () => {
  it("lists the photos by order, then the videos", () => {
    const items = heroItems({
      images: [
        { image: "/b.jpg", order: 1 },
        { image: "/a.jpg", order: 0 },
      ],
      videos: [{ id: "v1", video: "/v.mp4", thumbnail: "/t.jpg", duration: 42, order: 0 }],
    } as Parameters<typeof heroItems>[0]);

    expect(items.map((item) => item.path)).toEqual(["/a.jpg", "/b.jpg", "/v.mp4"]);
    expect(items[2]).toMatchObject({ kind: "video", poster: "/t.jpg", duration: 42 });
  });

  it("is empty for a recipe with no media", () => {
    expect(heroItems({ images: [], videos: [] })).toEqual([]);
  });
});
