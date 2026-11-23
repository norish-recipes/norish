import { describe, expect, it } from "vitest";

import { listState } from "../utils/list-state";

const of = (count: number, answered: boolean, isLoading: boolean, error: unknown = null) =>
  listState({ count, answered, isLoading, error });

describe("connections list state", () => {
  it("loads, then lists or says empty once the server answered", () => {
    expect(of(0, false, true)).toBe("loading");
    expect(of(2, true, false)).toBe("list");
    expect(of(0, true, false)).toBe("empty");
  });

  it("never shows the empty state for a read that did not answer", () => {
    expect(of(0, false, false, new Error("x"))).toBe("failed");
    expect(of(0, false, false)).toBe("failed");
  });

  it("keeps a cached list, or a cached empty one, through a failed refetch", () => {
    expect(of(2, true, false, new Error("x"))).toBe("list");
    expect(of(0, true, false, new Error("x"))).toBe("empty");
  });
});
