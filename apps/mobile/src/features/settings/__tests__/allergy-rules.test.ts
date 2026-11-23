import { describe, expect, it, vi } from "vitest";

import {
  allergiesToSend,
  allergySuggestions,
  canSaveAllergies,
  keptAllergyDraft,
  saveAllergies,
  shownAllergies,
  withAllergy,
  withoutAllergy,
} from "../utils/allergy-rules";

const base = { draft: null, saved: ["nuts"], saving: false, offline: false };

describe("the allergy chips", () => {
  it("show the saved allergies until one is edited, a draft after, and another device's change when nothing is edited", () => {
    expect(shownAllergies(null, ["nuts"])).toEqual(["nuts"]);
    expect(shownAllergies(["nuts", "milk"], ["nuts"])).toEqual(["nuts", "milk"]);
    expect(shownAllergies(null, ["gluten"])).toEqual(["gluten"]);
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

describe("what Save sends", () => {
  it("is nothing for an untouched draft or the saved set in another order", () => {
    expect(allergiesToSend(null, ["nuts"])).toBeNull();
    expect(allergiesToSend(["milk", "nuts"], ["nuts", "milk"])).toBeNull();
  });

  it("is nothing for a case-only or repeated edit, which the server stores as the same tags", () => {
    expect(allergiesToSend(["Nuts"], ["nuts"])).toBeNull();
    expect(allergiesToSend(["nuts", "NUTS"], ["nuts"])).toBeNull();
  });

  it("is the draft when it differs, including an emptied list", () => {
    expect(allergiesToSend(["nuts", "milk"], ["nuts"])).toEqual(["nuts", "milk"]);
    expect(allergiesToSend([], ["nuts"])).toEqual([]);
  });

  it("is the draft when another device saved what the draft started from", () => {
    expect(allergiesToSend(["nuts"], ["gluten"])).toEqual(["nuts"]);
  });
});

describe("a draft that sends nothing", () => {
  it("is dropped, so it cannot undo another device's change", () => {
    const saving = false;

    expect(keptAllergyDraft({ draft: ["nuts"], saved: ["nuts"], saving })).toBeNull();
    expect(keptAllergyDraft({ draft: ["milk"], saved: ["nuts"], saving })).toEqual(["milk"]);
  });

  it("is held while its save is on its way", () => {
    expect(keptAllergyDraft({ draft: ["nuts"], saved: ["nuts"], saving: true })).toEqual(["nuts"]);
  });
});

describe("Save", () => {
  it("is on only with something to send, and never while saving or Offline", () => {
    expect(canSaveAllergies(base)).toBe(false);
    expect(canSaveAllergies({ ...base, draft: ["milk"] })).toBe(true);
    expect(canSaveAllergies({ ...base, draft: ["milk"], saving: true })).toBe(false);
    expect(canSaveAllergies({ ...base, draft: ["milk"], offline: true })).toBe(false);
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

describe("saveAllergies", () => {
  const sent = ["milk"];
  const run = async (answer: boolean, current: string[] | null = sent) => {
    const setAllergies = vi.fn().mockResolvedValue(answer);
    let draft = current;

    await saveAllergies({
      draft: sent,
      saved: ["nuts"],
      setAllergies,
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

    await saveAllergies({ draft: ["nuts"], saved: ["nuts"], setAllergies, setDraft: vi.fn() });

    expect(setAllergies).not.toHaveBeenCalled();
  });
});
