import { describe, expect, it } from "vitest";

import { adminViewOf, canCreate, householdState, pageState } from "../utils/household-rules";

const base = { id: "h", name: "Home", version: 1, users: [], allergies: [] };

describe("household rules", () => {
  it("names the state from the household and the role", () => {
    expect(householdState(null, false)).toBe("none");
    expect(householdState(base, false)).toBe("member");
    expect(householdState(base, true)).toBe("admin");
  });

  it("never shows the forms to a member whose household failed to load", () => {
    expect(pageState({ household: base, isLoading: false, error: null })).toBe("household");
    expect(pageState({ household: null, isLoading: true, error: null })).toBe("loading");
    expect(pageState({ household: null, isLoading: false, error: null })).toBe("none");
    expect(pageState({ household: null, isLoading: false, error: new Error("x") })).toBe("failed");
    expect(pageState({ household: base, isLoading: false, error: new Error("x") })).toBe(
      "household"
    );
  });

  it("finds a join code only on the admin's household", () => {
    expect(adminViewOf(base)).toBeNull();
    expect(adminViewOf({ ...base, joinCode: "123456", joinCodeExpiresAt: null })).not.toBeNull();
  });

  it("needs a name to create", () => {
    expect(canCreate("  ")).toBe(false);
    expect(canCreate("Home")).toBe(true);
  });
});
