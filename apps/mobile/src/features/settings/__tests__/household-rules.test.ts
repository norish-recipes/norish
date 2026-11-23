import { describe, expect, it } from "vitest";

import { adminViewOf, canCreate, pageState } from "../utils/household-rules";

const base = { id: "h", name: "Home", version: 1, users: [], allergies: [] };

describe("household rules", () => {
  it("never shows the forms to a member whose household failed to load", () => {
    expect(pageState({ household: base, isLoading: false, error: null })).toBe("household");
    const of = (
      household: typeof base | null,
      answered: boolean,
      isLoading: boolean,
      error: unknown
    ) => pageState({ household, answered, isLoading, error });

    expect(of(base, true, false, null)).toBe("household");
    expect(of(null, false, true, null)).toBe("loading");
    expect(of(null, true, false, null)).toBe("none");
    expect(of(null, false, false, new Error("x"))).toBe("failed");
    expect(of(base, true, false, new Error("x"))).toBe("household");
  });

  it("keeps the forms when a refetch fails after the server said there is no household", () => {
    expect(
      pageState({ household: null, answered: true, isLoading: false, error: new Error("x") })
    ).toBe("none");
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
