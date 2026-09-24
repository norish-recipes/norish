// @vitest-environment node

import { describe, expect, it } from "vitest";

import { summarisePage } from "@norish/api/parser/page-summary";

describe("summarisePage", () => {
  it("names the page, its headings, meta tags and the recipe its JSON-LD describes", () => {
    const summary = summarisePage(`<html><head>
      <title> Stew | Example </title>
      <meta property="og:title" content="Beef stew">
      <meta name="description" content="A slow stew">
      <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[{"@type":"WebPage"},{"@type":"Recipe","name":"Beef stew"}]}
      </script>
    </head><body><main><h1>Beef stew</h1><p>Brown the beef.</p></main></body></html>`);

    expect(summary).toMatchObject({
      title: "Stew | Example",
      headings: ["Beef stew"],
      meta: { "og:title": "Beef stew", description: "A slow stew" },
      jsonLd: {
        types: ["WebPage", "Recipe"],
        recipes: [{ "@type": "Recipe", name: "Beef stew" }],
        unreadable: 0,
      },
    });
    expect(summary.text).toContain("Brown the beef.");
  });

  it("shows a page with no recipe in it for what it is", () => {
    const summary = summarisePage(
      "<html><head><title>Just a moment...</title></head><body><p>Checking your browser</p></body></html>"
    );

    expect(summary).toMatchObject({
      title: "Just a moment...",
      jsonLd: { types: [], recipes: [], unreadable: 0 },
      text: "Checking your browser",
    });
  });

  it("counts JSON-LD it cannot read, and keeps the text short of the monitor's cut-off", () => {
    const summary = summarisePage(
      `<html><head><script type="application/ld+json">{"@type": "Recipe", "name": }}}</script></head>` +
        `<body><p>${"word ".repeat(1000)}</p></body></html>`
    );

    expect(summary.jsonLd.unreadable + summary.jsonLd.recipes.length).toBeGreaterThan(0);
    expect(summary.text.length).toBeLessThanOrEqual(2001);
  });
});
