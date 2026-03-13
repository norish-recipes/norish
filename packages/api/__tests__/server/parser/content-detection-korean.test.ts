// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { isPageLikelyRecipe } from "@norish/api/parser";
import defaultContentIndicators from "@norish/config/content-indicators.default.json";

vi.mock("@norish/config/server-config-loader", async () => {
  const actual = await vi.importActual<typeof import("@norish/config/server-config-loader")>(
    "@norish/config/server-config-loader"
  );

  return {
    ...actual,
    getContentIndicators: vi.fn(async () => defaultContentIndicators),
  };
});

describe("isPageLikelyRecipe Korean content detection", () => {
  it("returns true when Korean recipe content has multiple indicator hits", async () => {
    const html = `
      <html>
        <body>
          <h1>김치찌개 레시피</h1>
          <section>재료</section>
          <section>조리 방법</section>
        </body>
      </html>
    `;

    await expect(isPageLikelyRecipe(html)).resolves.toBe(true);
  });

  it("returns false when Korean content has only one indicator hit", async () => {
    const html = `
      <html>
        <body>
          <h1>요리 노트</h1>
          <p>재료를 미리 준비하세요.</p>
        </body>
      </html>
    `;

    await expect(isPageLikelyRecipe(html)).resolves.toBe(false);
  });
});
