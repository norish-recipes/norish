// @vitest-environment node

import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("next-intl request config alias", () => {
  it("uses app-root i18n request path for turbopack alias", async () => {
    const configModule = await import("next/dist/server/config.js");
    const loadConfig =
      typeof configModule.default === "function"
        ? configModule.default
        : configModule.default.default;
    const projectRoot = resolve(import.meta.dirname, "../../..");

    const config = await loadConfig("phase-development-server", resolve(projectRoot, "apps/web"));

    expect(config.turbopack?.resolveAlias?.["next-intl/config"]).toBe("./i18n/request.ts");
  });
});
