import { describe, expect, it } from "vitest";

import { isJoinCode } from "../household-rules";

describe("household rules", () => {
  it("takes exactly six digits as a join code", () => {
    expect(isJoinCode("123456")).toBe(true);
    expect(isJoinCode("")).toBe(false);
    expect(isJoinCode("12345")).toBe(false);
    expect(isJoinCode("1234567")).toBe(false);
    expect(isJoinCode("123456 extra")).toBe(false);
    expect(isJoinCode("abcdef")).toBe(false);
  });
});
