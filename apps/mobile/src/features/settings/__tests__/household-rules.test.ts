import { describe, expect, it } from "vitest";

import {
  adminViewOf,
  canCreate,
  householdState,
  joinCodeStatus,
  leaveWarns,
  memberActions,
} from "../utils/household-rules";

const base = { id: "h", name: "Home", version: 1, users: [], allergies: [] };

describe("household rules", () => {
  it("gives only an admin Kick and Make admin, on others", () => {
    expect(memberActions(true, false, false)).toEqual(["kick", "admin"]);
    expect(memberActions(true, false, true)).toEqual(["kick"]);
    expect(memberActions(true, true, true)).toEqual([]);
    expect(memberActions(false, false, false)).toEqual([]);
  });

  it("names the state from the household and the role", () => {
    expect(householdState(null, false)).toBe("none");
    expect(householdState(base, false)).toBe("member");
    expect(householdState(base, true)).toBe("admin");
  });

  it("finds a join code only on the admin's household", () => {
    expect(adminViewOf(base)).toBeNull();
    expect(adminViewOf({ ...base, joinCode: "123456", joinCodeExpiresAt: null })).not.toBeNull();
  });

  it("counts the code down, and expires it", () => {
    const at = new Date(1_000_000 + 125_000);
    const code = (joinCode: string | null, expires: Date | null) => ({
      joinCode,
      joinCodeExpiresAt: expires,
    });

    expect(joinCodeStatus(code(null, null), 0)).toEqual({ kind: "none" });
    expect(joinCodeStatus(code("1", at), 1_000_000)).toEqual({
      kind: "active",
      minutes: 2,
      seconds: 5,
    });
    expect(joinCodeStatus(code("1", at), at.getTime())).toEqual({ kind: "expired" });
  });

  it("warns an admin leaving with others, nobody else", () => {
    expect(leaveWarns(true, 2)).toBe(true);
    expect(leaveWarns(true, 1)).toBe(false);
    expect(leaveWarns(false, 3)).toBe(false);
  });

  it("needs a name to create", () => {
    expect(canCreate("  ")).toBe(false);
    expect(canCreate("Home")).toBe(true);
  });
});
