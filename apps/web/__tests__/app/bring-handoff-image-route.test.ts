// @vitest-environment node
/**
 * The recipe's picture for a Bring Handoff: served under the handoff's token only, for as long as
 * the handoff lives, and only when the handoff holds a file this instance stores.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const handoffs = vi.hoisted(() => ({ readHandoff: vi.fn() }));
const media = vi.hoisted(() => ({ serveRecipeMedia: vi.fn() }));

vi.mock("@/lib/server-package", () => ({
  serverPackage: async () => ({ readHandoff: handoffs.readHandoff }),
}));
vi.mock("@/lib/recipe-media", () => media);

const { GET, runtime } = await import("@/app/share/bring/[token]/image/route");

const TOKEN = "A".repeat(32);

const get = (token: string) =>
  GET(new Request(`https://norish.example/share/bring/${token}/image`), {
    params: Promise.resolve({ token }),
  } as never);

describe("the Bring handoff picture", () => {
  beforeEach(() => {
    handoffs.readHandoff.mockReset();
    media.serveRecipeMedia.mockReset().mockResolvedValue(new Response("img", { status: 200 }));
  });

  it("runs on Node", () => {
    expect(runtime).toBe("nodejs");
  });

  it("serves the stored file of the handoff's recipe, uncached", async () => {
    handoffs.readHandoff.mockResolvedValue({
      title: "x",
      servings: 1,
      lines: [],
      image: { recipeId: "r-1", file: "a.jpg" },
      createdAt: 1,
    });

    const response = await get(TOKEN);

    expect(response.status).toBe(200);
    expect(media.serveRecipeMedia).toHaveBeenCalledWith(
      expect.any(Request),
      "r-1",
      "a.jpg",
      "private, no-store"
    );
  });

  it("answers 404 to a malformed token without looking it up", async () => {
    const response = await get("short");

    expect(response.status).toBe(404);
    expect(handoffs.readHandoff).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown or expired token", null],
    ["a handoff with no picture", { title: "x", servings: 1, lines: [], image: null }],
    [
      "a picture that lives elsewhere on the web",
      { title: "x", servings: 1, lines: [], image: { url: "https://cdn.example/a.jpg" } },
    ],
  ])("answers 404 for %s", async (_, handoff) => {
    handoffs.readHandoff.mockResolvedValue(handoff);

    const response = await get(TOKEN);

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(media.serveRecipeMedia).not.toHaveBeenCalled();
  });
});
