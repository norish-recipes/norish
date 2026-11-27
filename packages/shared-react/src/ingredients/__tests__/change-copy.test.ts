import { describe, expect, it } from "vitest";

import type { AIChange } from "../types";
import { changeCopy } from "../change-copy";
import { factSourceCopy, sourceCopy, spoonKey } from "../nutrition-copy";
import { aiChangesView } from "../use-ai-changes";

const change = (over: Partial<AIChange>): AIChange => ({
  id: "c",
  kind: "merge",
  sure: false,
  kept: false,
  createdAt: new Date(0),
  ingredient: null,
  target: null,
  dropped: null,
  from: null,
  canAct: true,
  ...over,
});

describe("changeCopy", () => {
  it("names the copy for each kind of change, with the foods it mentions", () => {
    const parent = { id: "p", name: "Sauces" };

    expect(changeCopy(change({ kind: "merge", from: "Soya" }), "en")).toMatchObject({
      key: "changedByAI.merge",
      values: { from: "Soya" },
    });
    expect(changeCopy(change({ kind: "parent", target: parent }), "en")).toMatchObject({
      key: "changedByAI.parent",
      values: { of: "Sauces" },
    });
    expect(changeCopy(change({ kind: "parent", dropped: parent }), "en")).toMatchObject({
      key: "changedByAI.parentDropped",
      values: { of: "Sauces" },
    });
    expect(changeCopy(change({ kind: "spelling", from: "x" }), "en").key).toBe(
      "changedByAI.spellingRemoved"
    );
    expect(changeCopy(change({ kind: "not-a-food" }), "en").key).toBe("changedByAI.notAFood");
  });
});

describe("aiChangesView", () => {
  it("splits open from settled changes, and answers all only for more than one the viewer may act on", () => {
    const open = change({ id: "a" });
    const mine = change({ id: "b" });
    const theirs = change({ id: "c", canAct: false });
    const settled = change({ id: "d", kept: true });
    const view = aiChangesView([open, mine, theirs, settled]);

    expect(view.unsure.map((it) => it.id)).toEqual(["a", "b", "c"]);
    expect(view.rest.map((it) => it.id)).toEqual(["d"]);
    expect(view.actionable.map((it) => it.id)).toEqual(["a", "b"]);
    expect(view.answerAll).toBe(true);
    expect(aiChangesView([open, theirs]).answerAll).toBe(false);
  });
});

describe("nutrition copy", () => {
  it("says where a fact came from, and what it was borrowed from", () => {
    const food = { dataset: "ciqual", code: "1", name: "Onion, raw" } as never;

    expect(sourceCopy({ kind: "household" })).toEqual({ key: "source.household", values: {} });
    expect(sourceCopy({ kind: "household-food", food } as never).key).toBe("source.householdFood");
    expect(
      factSourceCopy({
        value: 1,
        source: { kind: "ai" },
        borrowedFrom: { name: "Onion" },
      } as never)
    ).toEqual({ source: { key: "source.ai", values: {} }, borrowedFrom: "Onion" });
  });

  it("keys each measure among the words of the panel", () => {
    expect(spoonKey("teaspoon")).toBe("teaspoon");
    expect(spoonKey("100ml")).toBe("hundredMl");
  });
});
