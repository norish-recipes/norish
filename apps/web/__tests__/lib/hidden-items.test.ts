import { HIDDEN_ITEMS, hiddenItemsPreference, partitionHiddenItems } from "@/lib/hidden-items";
import { beforeEach, describe, expect, it } from "vitest";

function clearCookie(name: string) {
  document.cookie = `${name}=;path=/;max-age=0`;
}

beforeEach(() => {
  clearCookie(hiddenItemsPreference.cookieName);
});

describe("the hidden items cookie", () => {
  it("parses an absent or empty value as nothing hidden", () => {
    expect(hiddenItemsPreference.parse(undefined)).toEqual([]);
    expect(hiddenItemsPreference.parse(null)).toEqual([]);
    expect(hiddenItemsPreference.parse("")).toEqual([]);
  });

  it("keeps an entry it does not recognise rather than dropping it", () => {
    // The settings control's carry rule depends on unknown entries surviving
    // storage: a name from a newer version must ride along untouched.
    expect(hiddenItemsPreference.parse("rating,something-newer")).toEqual([
      "rating",
      "something-newer",
    ]);
  });

  it("reads back what it wrote", () => {
    hiddenItemsPreference.writeCookie(["rating", "timers"]);

    expect(hiddenItemsPreference.readCookie()).toEqual(["rating", "timers"]);
  });

  it("reads null when this browser has never written a list", () => {
    expect(hiddenItemsPreference.readCookie()).toBeNull();
  });

  it("reads an explicitly emptied list as empty, not as never-chosen", () => {
    hiddenItemsPreference.writeCookie([]);

    expect(hiddenItemsPreference.readCookie()).toEqual([]);
  });

  it("reads the stored list out of a request's cookies", () => {
    const cookieStore = { get: () => ({ value: "nutrition,notes" }) };

    expect(hiddenItemsPreference.readFrom(cookieStore)).toEqual(["nutrition", "notes"]);
  });

  it("drops duplicates and empty entries from a hand-edited value", () => {
    expect(hiddenItemsPreference.parse(",rating,,rating, notes ,")).toEqual(["rating", "notes"]);
  });
});

describe("partitionHiddenItems", () => {
  it("splits a stored list into what a control can offer and what it must carry", () => {
    // Selected names come back in contract order, whatever order they were stored.
    expect(partitionHiddenItems(["something-newer", "rating", "notes"])).toEqual({
      selected: ["notes", "rating"],
      carried: ["something-newer"],
    });
  });

  it("splits an empty list into nothing and nothing", () => {
    expect(partitionHiddenItems([])).toEqual({ selected: [], carried: [] });
  });

  it("carries a known name a control is not currently offering", () => {
    const offered = HIDDEN_ITEMS.filter((item) => item !== "timers");

    expect(partitionHiddenItems(["timers", "rating"], offered)).toEqual({
      selected: ["rating"],
      carried: ["timers"],
    });
  });
});
