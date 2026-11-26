// @vitest-environment node
import fs from "node:fs";
import { describe, expect, it } from "vitest";

import { CATALOGUE_EXPORT_PATH, DATA_SOURCE_LINKS } from "../data-sources";

const messages = JSON.parse(
  fs.readFileSync(
    new URL("../../../../i18n/src/messages/en/settings.json", import.meta.url),
    "utf8"
  )
) as { ingredients: { dataSources: Record<string, string> } };

describe("DATA_SOURCE_LINKS", () => {
  it("links every tag its notice wraps, and only those", () => {
    for (const [notice, links] of Object.entries(DATA_SOURCE_LINKS)) {
      const tags = [...messages.ingredients.dataSources[notice]!.matchAll(/<(\w+)>/g)].map(
        (match) => match[1]
      );

      expect(Object.keys(links).sort()).toEqual([...new Set(tags)].sort());
    }
  });

  it("opens every source on https", () => {
    for (const links of Object.values(DATA_SOURCE_LINKS)) {
      for (const url of Object.values(links)) expect(url).toMatch(/^https:\/\//);
    }
  });
});

describe("CATALOGUE_EXPORT_PATH", () => {
  it("is the route the web app serves the catalogue from", () => {
    expect(CATALOGUE_EXPORT_PATH).toBe("/export/ingredients");
    expect(
      fs.existsSync(
        new URL("../../../../../apps/web/app/(app)/export/ingredients/route.ts", import.meta.url)
      )
    ).toBe(true);
  });
});
