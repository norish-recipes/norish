import manifest from "@/app/manifest";
import { describe, expect, it } from "vitest";

describe("manifest", () => {
  it("sends a shared link to the import page", () => {
    expect(manifest().share_target).toEqual({
      action: "/import",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    });
  });
});
