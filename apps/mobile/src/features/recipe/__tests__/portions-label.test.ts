import { describe, expect, it } from "vitest";

import { aroundCount } from "../utils/portions-label";

describe("aroundCount", () => {
  it("splits a label around its number", () => {
    expect(aroundCount("2 portions", "2")).toEqual(["", " portions"]);
    expect(aroundCount("portions: 2", "2")).toEqual(["portions: ", ""]);
  });

  it("gives up where the number is not there exactly once", () => {
    expect(aroundCount("portion", "1")).toBeNull();
    expect(aroundCount("2 of 2", "2")).toBeNull();
  });
});
