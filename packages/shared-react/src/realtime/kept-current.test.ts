import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isKeptCurrent, useKeepsCurrent } from "@norish/shared-react/realtime";

describe("useKeepsCurrent", () => {
  it("keeps a read current while any keeper of it is mounted", () => {
    const list = ["groceries", "list"];
    const screen = renderHook(() => useKeepsCurrent([list]));
    const shell = renderHook(() => useKeepsCurrent([list]));

    expect(isKeptCurrent(list, Date.now())).toBe(true);
    screen.unmount();
    expect(isKeptCurrent(list, Date.now())).toBe(true);
    shell.unmount();
    expect(isKeptCurrent(list, Date.now())).toBe(false);
  });

  it("keeps every read under a key it keeps, whatever its input, and no other", () => {
    const shell = renderHook(() => useKeepsCurrent([[["ingredients", "icons"]]]));

    expect(
      isKeptCurrent(
        [["ingredients", "icons"], { input: { ids: ["i1"] }, type: "query" }],
        Date.now()
      )
    ).toBe(true);
    expect(isKeptCurrent([["ingredients", "uses"], { type: "query" }], Date.now())).toBe(false);
    shell.unmount();
    expect(isKeptCurrent([["ingredients", "icons"], { type: "query" }], Date.now())).toBe(false);
  });

  it("keeps only data that arrived after its keeper mounted", () => {
    const list = ["groceries", "list"];
    const before = Date.now() - 1;
    const shell = renderHook(() => useKeepsCurrent([list]));

    expect(isKeptCurrent(list, before)).toBe(false);
    expect(isKeptCurrent(list, Date.now())).toBe(true);
    shell.unmount();
  });
});
