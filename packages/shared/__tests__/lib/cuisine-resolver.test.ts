/**
 * The cuisine resolver.
 *
 * The one genuinely new module in Recipe Provenance, and a pure function:
 * proposed names, strategy, and the current vocabulary in; resolved rows, names
 * to create, and dropped names out. No database and no AI, which is why it can
 * be tested exhaustively.
 */

import { describe, expect, it } from "vitest";

import { resolveCuisines } from "@norish/shared/lib/cuisine-resolver";

const VOCABULARY = [
  { id: "id-italian", name: "Italian" },
  { id: "id-japanese", name: "Japanese" },
  { id: "id-mediterranean", name: "Mediterranean" },
  { id: "id-middle-eastern", name: "Middle Eastern" },
  { id: "id-thai", name: "Thai" },
  { id: "id-american", name: "American" },
];

function resolve(proposed: string[], strategy: "existing" | "extend" = "existing") {
  return resolveCuisines({ proposed, strategy, vocabulary: VOCABULARY });
}

describe("resolveCuisines", () => {
  it("returns nothing for an empty proposal set", () => {
    expect(resolve([])).toEqual({ resolved: [], created: [], dropped: [] });
  });

  it("matches an exact name", () => {
    expect(resolve(["Italian"]).resolved).toEqual([{ id: "id-italian", name: "Italian" }]);
  });

  it("matches across case and surrounding whitespace", () => {
    expect(resolve(["  iTaLiAn  "]).resolved).toEqual([{ id: "id-italian", name: "Italian" }]);
  });

  it("matches across punctuation and diacritics", () => {
    expect(resolve(["middle-eastern"]).resolved).toEqual([
      { id: "id-middle-eastern", name: "Middle Eastern" },
    ]);
    expect(resolve(["Thaï"]).resolved).toEqual([{ id: "id-thai", name: "Thai" }]);
  });

  it("drops blank and whitespace-only proposals without reporting them", () => {
    expect(resolve(["", "   ", "\n"])).toEqual({ resolved: [], created: [], dropped: [] });
  });

  describe("near misses", () => {
    it.each([
      ["Italiana", "id-italian"],
      ["Japanse", "id-japanese"],
      ["Mediteranean", "id-mediterranean"],
    ])("lands %s on the row that already means it", (proposed, id) => {
      expect(resolve([proposed]).resolved.map((row) => row.id)).toEqual([id]);
    });

    it("matches near misses under extend too, rather than minting a duplicate", () => {
      // This is the whole point of the vocabulary: matching runs under both
      // strategies, not only the restrictive one.
      const result = resolve(["Italiana"], "extend");

      expect(result.resolved).toEqual([{ id: "id-italian", name: "Italian" }]);
      expect(result.created).toEqual([]);
    });

    it("does not confuse two genuinely different names that look alike", () => {
      // American/Mexican are similar enough to be a real collision risk.
      expect(resolve(["Mexican"]).resolved).toEqual([]);
      expect(resolve(["Mexican"]).dropped).toEqual(["Mexican"]);
    });

    it("leaves a translated name unmatched, which is why the prompt pins the language", () => {
      expect(resolve(["Giapponese"]).resolved).toEqual([]);
      expect(resolve(["Française"]).resolved).toEqual([]);
    });
  });

  describe("unmatched names", () => {
    it("drops them under existing and creates nothing", () => {
      const result = resolve(["Basque", "Italian"]);

      expect(result.resolved).toEqual([{ id: "id-italian", name: "Italian" }]);
      expect(result.created).toEqual([]);
      expect(result.dropped).toEqual(["Basque"]);
    });

    it("creates them under extend and drops nothing", () => {
      const result = resolve(["Basque", "Italian"], "extend");

      expect(result.resolved).toEqual([{ id: "id-italian", name: "Italian" }]);
      expect(result.created).toEqual(["Basque"]);
      expect(result.dropped).toEqual([]);
    });

    it("keeps the proposed spelling of a name it creates", () => {
      expect(resolve(["  tex-mex  "], "extend").created).toEqual(["tex-mex"]);
    });
  });

  describe("duplicate proposals", () => {
    it("collapses spellings of the same row into one", () => {
      const result = resolve(["Italian", "  italian ", "Italiana"]);

      expect(result.resolved).toEqual([{ id: "id-italian", name: "Italian" }]);
    });

    it("collapses repeated new names into one creation", () => {
      const result = resolve(["Basque", "basque", "  BASQUE"], "extend");

      expect(result.created).toEqual(["Basque"]);
    });

    it("collapses repeated dropped names into one report", () => {
      expect(resolve(["Basque", "basque"]).dropped).toEqual(["Basque"]);
    });

    it("does not create a name that a sibling proposal already created", () => {
      // Two near-miss spellings of the same new name must not become two rows.
      expect(resolve(["Basquee", "Basque"], "extend").created).toEqual(["Basquee"]);
    });
  });

  it("preserves the order the names were proposed in", () => {
    const result = resolve(["Thai", "Italian", "Basque"], "extend");

    expect(result.resolved.map((row) => row.name)).toEqual(["Thai", "Italian"]);
    expect(result.created).toEqual(["Basque"]);
  });

  it("matches against an empty vocabulary by creating or dropping everything", () => {
    expect(
      resolveCuisines({ proposed: ["Italian"], strategy: "existing", vocabulary: [] })
    ).toEqual({ resolved: [], created: [], dropped: ["Italian"] });
    expect(resolveCuisines({ proposed: ["Italian"], strategy: "extend", vocabulary: [] })).toEqual({
      resolved: [],
      created: ["Italian"],
      dropped: [],
    });
  });
});
