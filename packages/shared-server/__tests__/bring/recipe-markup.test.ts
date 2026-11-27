import { describe, expect, it } from "vitest";

import { jsonLdFor, renderHandoffHtml } from "@norish/shared-server/bring/recipe-markup";

const handoff = { title: "Pasta", servings: 4, lines: ["200 g Mehl", "2 Eier"] };
const base = "https://norish.example.com/app";
const page = { baseUrl: base, token: "T".repeat(32) };
const SCRIPT = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;

function jsonLdOf(html: string): unknown {
  return JSON.parse(SCRIPT.exec(html)?.[1] ?? "null");
}

describe("the Bring Handoff page", () => {
  it("is a schema.org Recipe with the name, yield, image and ingredients", () => {
    expect(jsonLdOf(renderHandoffHtml(handoff, page))).toEqual({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Pasta",
      author: { "@type": "Organization", name: "Norish" },
      image: [`${base}/brand/icon-512.png`],
      recipeYield: "4",
      recipeIngredient: ["200 g Mehl", "2 Eier"],
    });
  });

  it("shows a stored picture through the handoff's own address, with no recipe id", () => {
    const stored = { ...handoff, image: { recipeId: "r-1", file: "a.jpg" } };
    const json = jsonLdFor(stored, page);

    expect(JSON.parse(json)).toMatchObject({
      image: [`${base}/share/bring/${page.token}/image`],
    });
    expect(json).not.toContain("r-1");
  });

  it("shows an imported picture at its own address", () => {
    const imported = { ...handoff, image: { url: "https://cdn.example/pasta.jpg" } };

    expect(JSON.parse(jsonLdFor(imported, page))).toMatchObject({
      image: ["https://cdn.example/pasta.jpg"],
    });
  });

  it("rounds the yield to at least one", () => {
    expect(JSON.parse(jsonLdFor({ ...handoff, servings: 0.4 }, page))).toMatchObject({
      recipeYield: "1",
    });
  });

  it("shows only the title and the lines", () => {
    const html = renderHandoffHtml(handoff, page);

    expect(html).toContain("<h1>Pasta</h1>");
    expect(html).toContain("<li>200 g Mehl</li><li>2 Eier</li>");
    expect(html).toContain('<meta name="robots" content="noindex,nofollow,noarchive">');
    expect(html).not.toContain("<a ");
  });

  it("escapes HTML in the title and the lines", () => {
    const html = renderHandoffHtml(
      { title: `<b>"Tom" & 'Jerry'</b>`, servings: 1, lines: ["<img src=x onerror=1>"] },
      page
    );

    expect(html).toContain("<h1>&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;</h1>");
    expect(html).toContain("<li>&lt;img src=x onerror=1&gt;</li>");
    expect(html).not.toContain("<img");
  });

  it("cannot be closed early from inside the JSON-LD", () => {
    const evil = { title: "</script><script>alert(1)</script>", servings: 1, lines: ["</script>"] };
    const html = renderHandoffHtml(evil, page);

    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(jsonLdOf(html)).toMatchObject({ name: evil.title, recipeIngredient: ["</script>"] });
  });

  it("escapes the JavaScript line separators", () => {
    const name = "a" + String.fromCharCode(0x2028) + "b" + String.fromCharCode(0x2029) + "c";
    const out = jsonLdFor({ title: name, servings: 1, lines: [] }, page);

    expect(out).not.toMatch(new RegExp("[" + String.fromCharCode(0x2028, 0x2029) + "]"));
    expect(out).toContain("\\u2028");
    expect(JSON.parse(out)).toMatchObject({ name });
  });
});
