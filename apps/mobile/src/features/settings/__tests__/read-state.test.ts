import { describe, expect, it } from "vitest";

import { readState } from "../utils/read-state";

const of = (held: boolean, answered: boolean, isLoading: boolean, error: unknown = null) =>
  readState({ held, answered, isLoading, error });

describe("read state", () => {
  it("loads, then shows what it holds or says empty once the server answered", () => {
    expect(of(false, false, true)).toBe("loading");
    expect(of(true, true, false)).toBe("held");
    expect(of(false, true, false)).toBe("empty");
  });

  it("never says empty for a read that did not answer, paused Offline included", () => {
    expect(of(false, false, false, new Error("x"))).toBe("failed");
    expect(of(false, false, false)).toBe("failed");
  });

  it("keeps what it holds, or an answered empty, through a failed refetch", () => {
    expect(of(true, true, false, new Error("x"))).toBe("held");
    expect(of(false, true, false, new Error("x"))).toBe("empty");
  });
});
