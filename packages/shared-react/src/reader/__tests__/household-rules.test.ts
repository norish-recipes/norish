import { describe, expect, it } from "vitest";

import { allowedMemberActions, isJoinCode, joinCodeStatus, leaveWarns } from "../household-rules";

describe("household rules", () => {
  it("takes exactly six digits as a join code", () => {
    expect(isJoinCode("123456")).toBe(true);
    expect(isJoinCode("")).toBe(false);
    expect(isJoinCode("12345")).toBe(false);
    expect(isJoinCode("1234567")).toBe(false);
    expect(isJoinCode("123456 extra")).toBe(false);
    expect(isJoinCode("abcdef")).toBe(false);
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
