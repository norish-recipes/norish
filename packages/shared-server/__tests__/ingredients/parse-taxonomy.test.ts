// @vitest-environment node
/**
 * Reading the Open Food Facts ingredients taxonomy, over an excerpt of the
 * real file: what an entry is, what it is called in every language, and what
 * it is a kind of.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  parseTaxonomy,
  TaxonomyParseError,
} from "@norish/shared-server/ingredients/seed/parse-taxonomy";

const excerpt = readFileSync(join(__dirname, "fixtures", "ingredients-taxonomy.txt"), "utf8");

describe("parseTaxonomy", () => {
  const entries = parseTaxonomy(excerpt);
  const entry = (id: string) => entries.find((candidate) => candidate.id === id);

  it("reads every entry and no synonyms or stopwords", () => {
    expect(entries.map((candidate) => candidate.id)).toEqual([
      "en:vegetable",
      "en:onion-family-vegetable",
      "en:onion",
      "pl:cebula-dymka",
      "en:red-onion",
      "en:imazalil",
      "en:salt,-sea",
    ]);
  });

  it("keeps every name in every language, the English one naming the entry", () => {
    const onion = entry("en:onion")!;

    expect(onion.name).toBe("onion");
    expect(onion.names).toEqual([
      { text: "onion", locale: "en" },
      { text: "onions", locale: "en" },
      { text: "Zwiebel", locale: "de" },
      { text: "Zwiebeln", locale: "de" },
      { text: "oignon", locale: "fr" },
      { text: "oignons", locale: "fr" },
      { text: "ui", locale: "nl" },
      { text: "uien", locale: "nl" },
      { text: "ajuin", locale: "nl" },
    ]);
  });

  it("names an entry with no English name by its first name", () => {
    expect(entry("pl:cebula-dymka")).toMatchObject({
      name: "cebula dymka",
      names: [{ text: "cebula dymka", locale: "pl" }],
    });
  });

  it("finds parents by any of their names, in order, and drops those the file lacks", () => {
    expect(entry("en:onion")?.parentIds).toEqual(["en:onion-family-vegetable"]);
    expect(entry("en:onion-family-vegetable")?.parentIds).toEqual(["en:vegetable"]);
    // Named by its plural.
    expect(entry("pl:cebula-dymka")?.parentIds).toEqual(["en:onion"]);
    expect(entry("en:vegetable")?.parentIds).toEqual([]);
  });

  it("keeps what an entry says about its nutrition, and no other property", () => {
    expect(entry("en:onion")?.nutrition).toEqual({
      ciqual: ["20034"],
      usda: ["ndb:11282", "fdc:170000"],
      ciqualOther: [],
      pieceWeight: 150,
      density: null,
    });
    expect(entry("en:vegetable")?.nutrition).toBeNull();
    expect(entry("en:red-onion")?.nutrition).toBeNull();
  });

  it("reads a proxy after the entry's own code, secondary codes apart, and density", () => {
    const [milk] = parseTaxonomy(
      [
        "en: milk",
        "ciqual_proxy_food_code:en: 19051",
        "ciqual_food_code:en: 19016",
        "agribalyse_food_code:en: 19016",
        "ciqual_food_2_code:en: 19024",
        "usda_ndb_proxy_code:en: 1077",
        "density_g_per_ml:en: 1.03",
        "",
      ].join("\n")
    );

    expect(milk?.nutrition).toEqual({
      ciqual: ["19016", "19051"],
      usda: ["ndb:1077"],
      ciqualOther: ["19024"],
      pieceWeight: null,
      density: 1.03,
    });
  });

  it("reads an every-language name as holding in no language in particular", () => {
    expect(entry("en:imazalil")?.names).toContainEqual({ text: "imazalil", locale: null });
  });

  it("reads an escaped comma as part of a name", () => {
    expect(entry("en:salt,-sea")?.name).toBe("salt, sea");
  });

  it("refuses a file that is not a taxonomy, such as an error page served in its place", () => {
    expect(() => parseTaxonomy("<!DOCTYPE html>\n<html><body>Rate limited</body></html>")).toThrow(
      TaxonomyParseError
    );
    expect(() => parseTaxonomy("# nothing but comments\n\nsynonyms:en: a, b\n")).toThrow(
      TaxonomyParseError
    );
  });
});
