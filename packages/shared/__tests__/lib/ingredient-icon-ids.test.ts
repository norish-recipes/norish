import { afterEach, describe, expect, it, vi } from "vitest";

import { iconIds } from "@norish/shared/lib/ingredient-icon-ids";

describe("iconIds", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("asks about each food once, in one order, however a surface lists them", () => {
    expect(iconIds(["b", null, "a", undefined, "b", ""])).toEqual(["a", "b"]);
    expect(iconIds(["a", "b"])).toEqual(iconIds(["b", "a", "a"]));
  });

  it("orders the same on a Danish browser as on the server, so the seed and the read match", () => {
    const ids = ["z9", "aa1", "ab2"];
    const danish = new Intl.Collator("da");

    // Danish collates "aa" as "å", after "z"; Node's en-US doesn't.
    vi.spyOn(String.prototype, "localeCompare").mockImplementation(function (
      this: string,
      that: string
    ) {
      return danish.compare(this, that);
    });

    expect([...ids].sort((a, b) => a.localeCompare(b))).toEqual(["ab2", "z9", "aa1"]);
    expect(iconIds(ids)).toEqual(["aa1", "ab2", "z9"]);
  });

  it("asks about no more foods than the read takes", () => {
    const ids = Array.from({ length: 600 }, (_, n) => String(n).padStart(3, "0"));

    expect(iconIds(ids)).toHaveLength(500);
  });
});
