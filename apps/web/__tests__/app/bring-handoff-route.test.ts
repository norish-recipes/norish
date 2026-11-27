// @vitest-environment node
/**
 * The public page Bring!'s servers fetch for a handoff: no session, so the token is the only
 * check, and a miss answers the same whatever the reason.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const handoffs = vi.hoisted(() => ({
  readHandoff: vi.fn(),
}));

vi.mock("@/lib/server-package", () => ({
  serverPackage: async (specifier: string) => {
    if (specifier.endsWith("handoff-store")) return { readHandoff: handoffs.readHandoff };
    if (specifier.endsWith("public-url"))
      return { publicBaseUrl: () => "https://norish.example/base" };

    return import("../../../../packages/shared-server/src/bring/recipe-markup");
  },
}));

const { GET, runtime } = await import("@/app/share/bring/[token]/route");

const TOKEN = "A".repeat(32);

const get = (token: string) =>
  GET(new Request(`https://norish.example/share/bring/${token}`), {
    params: Promise.resolve({ token }),
  } as never);

/** The headers a hit and a miss share. */
const PRIVATE = {
  "x-robots-tag": "noindex, nofollow, noarchive",
  "cache-control": "private, no-store",
  "referrer-policy": "no-referrer",
  "content-security-policy": "default-src 'none'",
  "x-content-type-options": "nosniff",
};

describe("the Bring handoff page", () => {
  beforeEach(() => {
    handoffs.readHandoff.mockReset();
  });

  it("runs on Node; a GET handler that awaits its params is never prerendered or cached", () => {
    expect(runtime).toBe("nodejs");
  });

  it.each([
    "short",
    "A".repeat(31),
    "A".repeat(33),
    `${"A".repeat(31)}!`,
    `${"A".repeat(30)}%2F`,
    "",
  ])("answers 404 to the malformed token %j without looking it up", async (token) => {
    const response = await get(token);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(handoffs.readHandoff).not.toHaveBeenCalled();
    for (const [name, value] of Object.entries(PRIVATE)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it("answers 404 with an empty body to an unknown or expired token, under the same headers", async () => {
    handoffs.readHandoff.mockResolvedValue(null);

    const response = await get(TOKEN);

    expect(handoffs.readHandoff).toHaveBeenCalledWith(TOKEN);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-type")).toBeNull();
    for (const [name, value] of Object.entries(PRIVATE)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it("serves a Recipe page with only the title and the lines, privately", async () => {
    handoffs.readHandoff.mockResolvedValue({
      title: "Lasagne <3",
      servings: 4,
      lines: ["500 g Mehl", "2 Eier"],
      createdAt: 1,
    });

    const response = await get(TOKEN);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    for (const [name, value] of Object.entries(PRIVATE)) {
      expect(response.headers.get(name)).toBe(value);
    }
    expect(html).toContain("<h1>Lasagne &lt;3</h1>");
    expect(html).toContain("<li>500 g Mehl</li><li>2 Eier</li>");

    const jsonLd = JSON.parse(
      html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]!
    );

    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Lasagne <3",
      author: { "@type": "Organization", name: "Norish" },
      image: ["https://norish.example/base/brand/icon-512.png"],
      recipeYield: "4",
      recipeIngredient: ["500 g Mehl", "2 Eier"],
    });
  });

  it("cannot be broken out of with a closing script tag in a line", async () => {
    handoffs.readHandoff.mockResolvedValue({
      title: "x",
      servings: 1,
      lines: ["</script><script>alert(1)</script>"],
      createdAt: 1,
    });

    const html = await (await get(TOKEN)).text();

    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });
});
