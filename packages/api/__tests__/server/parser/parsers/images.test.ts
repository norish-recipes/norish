// @vitest-environment node
import { describe, expect, it } from "vitest";

import { extractImageCandidates } from "@norish/api/parser/parsers/images";

describe("extractImageCandidates", () => {
  it("filters header, footer, and nav images", () => {
    const html = `
      <html>
        <body>
          <header><img src="/logo.jpg" alt="site logo" width="180" height="50" /></header>
          <nav><img src="/menu.jpg" alt="menu icon" width="40" height="40" /></nav>
          <main>
            <article>
              <img src="/food.jpg" alt="Tomato pasta in bowl" width="1200" height="800" />
            </article>
          </main>
          <footer><img src="/footer.jpg" alt="footer badge" width="80" height="80" /></footer>
        </body>
      </html>
    `;

    const urls = extractImageCandidates(html, "https://example.com/recipes/pasta");

    expect(urls).toContain("https://example.com/food.jpg");
    expect(urls).not.toContain("https://example.com/logo.jpg");
    expect(urls).not.toContain("https://example.com/menu.jpg");
    expect(urls).not.toContain("https://example.com/footer.jpg");
  });

  it("supports lazy attributes and resolves relative urls", () => {
    const html = `
      <html>
        <body>
          <main>
            <article>
              <img data-src="/images/lasagna.jpg" alt="Baked lasagna" width="1024" height="768" />
            </article>
          </main>
        </body>
      </html>
    `;

    const urls = extractImageCandidates(html, "https://example.com/recipes/lasagna");

    expect(urls).toContain("https://example.com/images/lasagna.jpg");
  });

  it("keeps social meta image and excludes logo-like img tags", () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="https://cdn.example.com/social-card.jpg" />
        </head>
        <body>
          <main>
            <img src="/assets/brand-logo.jpg" alt="brand logo" width="300" height="100" />
            <img src="/images/curry.jpg" alt="Spicy curry" width="900" height="650" />
          </main>
        </body>
      </html>
    `;

    const urls = extractImageCandidates(html, "https://example.com");

    expect(urls).toContain("https://cdn.example.com/social-card.jpg");
    expect(urls).toContain("https://example.com/images/curry.jpg");
    expect(urls).not.toContain("https://example.com/assets/brand-logo.jpg");
  });

  it("leads with the image whose alt names the recipe, ahead of a site-wide social image and larger related-recipe cards", () => {
    // The shape of a Wegmans recipe page: one share card for every page, an unsized hero whose alt
    // is the recipe's name, and "More like this" cards that are larger on paper.
    const html = `
      <html>
        <head>
          <title>Caprese Ravioli with Balsamic Glaze | Wegmans</title>
          <meta property="og:title" content="Recipe | Wegmans" />
          <meta property="og:image" content="https://images.example.com/site-share-card?wid=1200&hei=630" />
        </head>
        <body>
          <img src="https://images.example.com/RECIPE_3019137" alt="Caprese Ravioli with Balsamic Glaze" class="object-cover" />
          <main>
            <h1>Caprese Ravioli with Balsamic Glaze</h1>
          </main>
          <section>
            <img src="https://images.example.com/RECIPE_21232" alt="" class="recipe-card-image" width="500" height="500" />
            <img src="https://images.example.com/RECIPE_3016332" alt="" class="recipe-card-image" width="500" height="500" />
          </section>
        </body>
      </html>
    `;

    const urls = extractImageCandidates(html, "https://www.example.com/recipes/caprese-ravioli");

    expect(urls[0]).toBe("https://images.example.com/RECIPE_3019137");
    expect(urls).toContain("https://images.example.com/site-share-card?wid=1200&hei=630");
  });

  it("recognises the recipe's name from the document title when the page has no heading", () => {
    const html = `
      <html>
        <head>
          <title>Lemon Herb Roast Chicken - Example Kitchen</title>
          <meta property="og:image" content="https://cdn.example.com/brand-share.jpg" />
        </head>
        <body>
          <main>
            <img src="/images/sidebar-ad.jpg" alt="Seasonal promotion" width="1200" height="900" />
            <img src="/images/roast-chicken.jpg" alt="Lemon herb roast chicken on a platter" />
          </main>
        </body>
      </html>
    `;

    const urls = extractImageCandidates(html, "https://example.com/roast-chicken");

    expect(urls[0]).toBe("https://example.com/images/roast-chicken.jpg");
  });

  it("takes one URL for a matching image rather than every srcset size of it", () => {
    const html = `
      <html>
        <head><title>Blueberry Buttermilk Pancakes | Example</title></head>
        <body>
          <main>
            <h1>Blueberry Buttermilk Pancakes</h1>
            <img
              src="/img/pancakes-800.jpg"
              srcset="/img/pancakes-400.jpg 400w, /img/pancakes-1200.jpg 1200w"
              alt="Blueberry Buttermilk Pancakes"
            />
          </main>
        </body>
      </html>
    `;

    const urls = extractImageCandidates(html, "https://example.com/pancakes");

    expect(urls[0]).toBe("https://example.com/img/pancakes-800.jpg");
    expect(urls.filter((url) => url.includes("pancakes"))).toHaveLength(1);
  });

  it("keeps the social image first when no image is named after the recipe", () => {
    const html = `
      <html>
        <head>
          <title>Weeknight Vegetable Stir Fry | Example</title>
          <meta property="og:image" content="https://cdn.example.com/stir-fry-card.jpg" />
        </head>
        <body>
          <main>
            <h1>Weeknight Vegetable Stir Fry</h1>
            <img src="/images/wok.jpg" alt="Vegetables in a hot wok" width="900" height="600" />
          </main>
        </body>
      </html>
    `;

    const urls = extractImageCandidates(html, "https://example.com/stir-fry");

    expect(urls[0]).toBe("https://cdn.example.com/stir-fry-card.jpg");
    expect(urls).toContain("https://example.com/images/wok.jpg");
  });

  it("does not treat a generic title as the recipe's name", () => {
    const html = `
      <html>
        <head>
          <title>Recipe | Example</title>
          <meta property="og:image" content="https://cdn.example.com/card.jpg" />
        </head>
        <body>
          <main>
            <img src="/images/badge.jpg" alt="Recipe" width="900" height="600" />
          </main>
        </body>
      </html>
    `;

    const urls = extractImageCandidates(html, "https://example.com/r");

    expect(urls[0]).toBe("https://cdn.example.com/card.jpg");
  });
});
