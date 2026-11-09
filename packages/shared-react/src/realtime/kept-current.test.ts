import { hashKey } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isKeptCurrent, useKeepsCurrent } from "@norish/shared-react/realtime";

describe("useKeepsCurrent", () => {
  it("keeps a read current while any keeper of it is mounted", () => {
    const list = ["groceries", "list"];
    const screen = renderHook(() => useKeepsCurrent([list]));
    const shell = renderHook(() => useKeepsCurrent([list]));

    expect(isKeptCurrent(hashKey(list))).toBe(true);
    screen.unmount();
    expect(isKeptCurrent(hashKey(list))).toBe(true);
    shell.unmount();
    expect(isKeptCurrent(hashKey(list))).toBe(false);
  });
});
