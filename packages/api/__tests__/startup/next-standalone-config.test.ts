/**
 * Production hands Next the config `next build` resolved through the variable
 * Next's own standalone server sets (http-server.ts). The image holds no
 * next.config.js, so a Next release that stopped reading the variable would
 * leave it on Next's defaults without a word, the image optimizer among them.
 * This fails on that upgrade instead.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

describe("the standalone config variable", () => {
  it("is what Next's config loader reads", () => {
    const require = createRequire(import.meta.url);
    const loader = readFileSync(require.resolve("next/dist/server/config.js"), "utf8");

    expect(loader).toContain("JSON.parse(process.env.__NEXT_PRIVATE_STANDALONE_CONFIG)");
  });
});
