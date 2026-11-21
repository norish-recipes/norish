// @vitest-environment jsdom
import { closeOpenRow, useOpenRow } from "@/lib/open-row";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function claim() {
  const close = vi.fn();
  const hook = renderHook(() => useOpenRow({ current: { close } }));

  return { close, ...hook };
}

describe("the open swipe row", () => {
  it("closes on a scroll or a touch elsewhere", () => {
    const first = claim();

    first.result.current.opened();
    closeOpenRow();
    expect(first.close).toHaveBeenCalledOnce();
  });

  it("closes the previous row when another opens", () => {
    const first = claim();
    const second = claim();

    first.result.current.opened();
    second.result.current.opened();
    expect(first.close).toHaveBeenCalledOnce();
    expect(second.close).not.toHaveBeenCalled();
    second.result.current.closed();
  });

  it("leaves the row the touch landed in, and forgets a row once it closed", () => {
    const first = claim();

    first.result.current.opened();
    closeOpenRow(first.result.current.row);
    expect(first.close).not.toHaveBeenCalled();
    first.result.current.closed();
    closeOpenRow();
    expect(first.close).not.toHaveBeenCalled();
  });

  it("forgets a row that unmounts open", () => {
    const first = claim();

    first.result.current.opened();
    first.unmount();
    closeOpenRow();
    expect(first.close).not.toHaveBeenCalled();
  });
});
