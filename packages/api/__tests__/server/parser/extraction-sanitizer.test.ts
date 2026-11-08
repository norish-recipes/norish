import { describe, expect, it } from "vitest";

import { extractSanitizedBody } from "@norish/api/parser/extraction-sanitizer";

const RECIPE = `
  <h2>Ingredients</h2>
  <ul><li>9 oz pesto burrata ravioli</li><li>2 tbsp salted butter</li></ul>
  <h2>Directions</h2>
  <p>Boil the ravioli in salted water until tender, then toss with the butter and serve warm.</p>
`;

describe("extractSanitizedBody", () => {
  it("reads the whole page when the only <article> is a review card", () => {
    const body = extractSanitizedBody(`<html><body>
      <div>${RECIPE}</div>
      <section><article><h3>Joe</h3><p>Rated 5 out of 5</p></article></section>
    </body></html>`);

    expect(body).toContain("9 oz pesto burrata ravioli");
    expect(body).toContain("Boil the ravioli");
  });

  it("keeps to an <article> that holds most of the page", () => {
    const body = extractSanitizedBody(`<html><body>
      <article>${RECIPE}</article>
      <p>Sign up for our newsletter</p>
    </body></html>`);

    expect(body).toContain("Boil the ravioli");
    expect(body).not.toContain("newsletter");
  });

  it("picks the largest <article> when a smaller one comes first", () => {
    const body = extractSanitizedBody(`<html><body>
      <article><p>Sponsored: try our new sauce</p></article>
      <article>${RECIPE}</article>
    </body></html>`);

    expect(body).toContain("Boil the ravioli");
    expect(body).not.toContain("Sponsored");
  });

  it("prefers <main> over any <article>", () => {
    const body = extractSanitizedBody(`<html><body>
      <main><div>${RECIPE}</div></main>
      <article><p>Unrelated story about something else entirely, told at great length here</p></article>
    </body></html>`);

    expect(body).toContain("Boil the ravioli");
    expect(body).not.toContain("Unrelated story");
  });

  it("does not count stripped navigation towards the page", () => {
    const body = extractSanitizedBody(`<html><body>
      <nav>${"Shop Recipes Stores Pharmacy Careers ".repeat(50)}</nav>
      <article>${RECIPE}</article>
    </body></html>`);

    expect(body).toContain("Boil the ravioli");
    expect(body).not.toContain("Pharmacy");
  });
});
