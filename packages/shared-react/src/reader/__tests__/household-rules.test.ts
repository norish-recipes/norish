import { describe, expect, it } from "vitest";

import {
  adminViewOf,
  allowedMemberActions,
  isHouseholdName,
  isJoinCode,
  joinCodeDigits,
  joinCodeStatus,
  leaveWarns,
} from "../household-rules";

describe("household rules", () => {
  it("needs a name to create", () => {
    expect(isHouseholdName("  ")).toBe(false);
    expect(isHouseholdName("Home")).toBe(true);
  });

  it("takes exactly six digits as a join code", () => {
    expect(isJoinCode("123456")).toBe(true);
    expect(isJoinCode("")).toBe(false);
    expect(isJoinCode("12345")).toBe(false);
    expect(isJoinCode("1234567")).toBe(false);
    expect(isJoinCode("123456 extra")).toBe(false);
    expect(isJoinCode("abcdef")).toBe(false);
  });

  it("keeps a pasted code's six digits, separators dropped first", () => {
    expect(joinCodeDigits("123-456")).toBe("123456");
    expect(joinCodeDigits("123 456")).toBe("123456");
    expect(joinCodeDigits("1234567")).toBe("123456");
    expect(isJoinCode(joinCodeDigits(" 12 34 56 "))).toBe(true);
  });

  it("shows the join code only to the viewer who is admin now", () => {
    const user = (id: string, isAdmin: boolean) => ({ id, name: id, isAdmin, version: 1 });
    const admin = (viewerIsAdmin: boolean) => ({
      id: "h",
      name: "Home",
      version: 1,
      allergies: [],
      users: [user("me", viewerIsAdmin), user("other", !viewerIsAdmin)],
      joinCode: "123456",
      joinCodeExpiresAt: null,
    });

    expect(adminViewOf(admin(true), "me")).not.toBeNull();
    // Admin moved to another member from elsewhere; the cached code fields stay behind.
    expect(adminViewOf(admin(false), "me")).toBeNull();
    expect(adminViewOf(admin(true), undefined)).toBeNull();
    const { joinCode: _code, joinCodeExpiresAt: _at, ...member } = admin(true);

    expect(adminViewOf(member, "me")).toBeNull();
  });

  it("gives only an admin Kick and Make admin, on others", () => {
    const of = (viewerIsAdmin: boolean, isSelf: boolean, memberIsAdmin: boolean) =>
      allowedMemberActions({ viewerIsAdmin, isSelf, memberIsAdmin });

    expect(of(true, false, false)).toEqual(["kick", "transferAdmin"]);
    expect(of(true, false, true)).toEqual(["kick"]);
    expect(of(true, true, true)).toEqual([]);
    expect(of(false, false, false)).toEqual([]);
  });

  it("counts the code down, and expires it", () => {
    const at = new Date(1_000_000 + 125_000);
    const code = (joinCode: string | null, expires: Date | null) => ({
      joinCode,
      joinCodeExpiresAt: expires,
    });

    expect(joinCodeStatus(code(null, null), 0)).toEqual({ kind: "none" });
    expect(joinCodeStatus(code("1", null), 0)).toEqual({ kind: "none" });
    expect(joinCodeStatus(code("1", at), 1_000_000)).toEqual({
      kind: "active",
      minutes: 2,
      seconds: 5,
    });
    expect(joinCodeStatus(code("1", at), at.getTime())).toEqual({ kind: "expired" });
  });

  it("warns an admin leaving with others, nobody else", () => {
    expect(leaveWarns({ isAdmin: true, otherMemberCount: 1 })).toBe(true);
    expect(leaveWarns({ isAdmin: true, otherMemberCount: 0 })).toBe(false);
    expect(leaveWarns({ isAdmin: false, otherMemberCount: 3 })).toBe(false);
  });
});
