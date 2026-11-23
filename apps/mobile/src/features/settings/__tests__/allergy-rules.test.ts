import { describe, expect, it, vi } from "vitest";

import {
  ALLERGY_DRAFT,
  allergySuggestions,
  withAllergy,
  withoutAllergy,
} from "../utils/allergy-rules";
import { canSave, isEdited, keptDraft, saveDraft, shownDraft } from "../utils/draft-rules";

const base = { draft: null, saved: ["nuts"], saving: false, offline: false };
const edited = (draft: string[] | null, saved: string[]) => isEdited(ALLERGY_DRAFT, draft, saved);

describe("the allergy chips", () => {
  it("show the saved allergies until one is edited, a draft after, and another device's change when nothing is edited", () => {
    expect(shownDraft(null, ["nuts"])).toEqual(["nuts"]);
    expect(shownDraft(["nuts", "milk"], ["nuts"])).toEqual(["nuts", "milk"]);
    expect(shownDraft(null, ["gluten"])).toEqual(["gluten"]);
  });

  it("add a trimmed name, and ignore a blank or repeated one in any case", () => {
    expect(withAllergy(["nuts"], " milk ")).toEqual(["nuts", "milk"]);
    expect(withAllergy(["nuts"], "  ")).toBeNull();
    expect(withAllergy(["nuts"], "NUTS")).toBeNull();
  });

  it("drop a name in any case", () => {
    expect(withoutAllergy(["nuts", "milk"], "Nuts")).toEqual(["milk"]);
  });
});

describe("whether Save sends the draft", () => {
  it("is no for an untouched draft or the saved set in another order", () => {
    expect(edited(null, ["nuts"])).toBe(false);
    expect(edited(["milk", "nuts"], ["nuts", "milk"])).toBe(false);
  });

  it("is no for a case-only or repeated edit, which the server stores as the same tags", () => {
    expect(edited(["Nuts"], ["nuts"])).toBe(false);
    expect(edited(["nuts", "NUTS"], ["nuts"])).toBe(false);
  });

  it("is yes when it differs, including an emptied list", () => {
    expect(edited(["nuts", "milk"], ["nuts"])).toBe(true);
    expect(edited([], ["nuts"])).toBe(true);
  });

  it("is yes when another device saved what the draft started from", () => {
    expect(edited(["nuts"], ["gluten"])).toBe(true);
  });
});

describe("a draft that sends nothing", () => {
  it("is dropped, so it cannot undo another device's change", () => {
    expect(keptDraft(ALLERGY_DRAFT, ["nuts"], ["nuts"], false)).toBeNull();
    expect(keptDraft(ALLERGY_DRAFT, ["milk"], ["nuts"], false)).toEqual(["milk"]);
  });

  it("is held while its save is on its way", () => {
    expect(keptDraft(ALLERGY_DRAFT, ["nuts"], ["nuts"], true)).toEqual(["nuts"]);
  });
});

describe("Save", () => {
  it("is on only with something to send, and never while saving or Offline", () => {
    expect(canSave(ALLERGY_DRAFT, base)).toBe(false);
    expect(canSave(ALLERGY_DRAFT, { ...base, draft: ["milk"] })).toBe(true);
    expect(canSave(ALLERGY_DRAFT, { ...base, draft: ["milk"], saving: true })).toBe(false);
    expect(canSave(ALLERGY_DRAFT, { ...base, draft: ["milk"], offline: true })).toBe(false);
  });
});

describe("the suggestions", () => {
  const known = ["Sesame seeds", "Sesame", "Peanuts", "Seeds"];

  it("hold what is typed, start-of-name first, without what is chosen", () => {
    expect(allergySuggestions(known, "ses", ["Seeds"])).toEqual(["Sesame", "Sesame seeds"]);
    expect(allergySuggestions(known, "seeds", [])).toEqual(["Seeds", "Sesame seeds"]);
    expect(allergySuggestions(known, "sesame", ["sesame"])).toEqual(["Sesame seeds"]);
  });

  it("are none for nothing typed", () => {
    expect(allergySuggestions(known, "  ", [])).toEqual([]);
  });
});

describe("saving the allergies", () => {
  const sent = ["milk"];
  const run = async (answer: boolean, current: string[] | null = sent) => {
    const setAllergies = vi.fn().mockResolvedValue(answer);
    let draft = current;

    await saveDraft(ALLERGY_DRAFT, {
      draft: sent,
      saved: ["nuts"],
      send: setAllergies,
      setDraft: (update) => void (draft = update(draft)),
    });

    return { setAllergies, draft };
  };

  it("sends the draft and drops it once the server took it", async () => {
    const { setAllergies, draft } = await run(true);

    expect(setAllergies).toHaveBeenCalledExactlyOnceWith(["milk"]);
    expect(draft).toBeNull();
  });

  it("keeps the draft when the write was refused or stale", async () => {
    expect((await run(false)).draft).toEqual(["milk"]);
  });

  it("keeps a draft changed while saving", async () => {
    expect((await run(true, ["milk", "eggs"])).draft).toEqual(["milk", "eggs"]);
  });

  it("sends nothing for a draft that matches what is saved", async () => {
    const setAllergies = vi.fn();

    await saveDraft(ALLERGY_DRAFT, {
      draft: ["nuts"],
      saved: ["nuts"],
      send: setAllergies,
      setDraft: vi.fn(),
    });

    expect(setAllergies).not.toHaveBeenCalled();
  });
});
