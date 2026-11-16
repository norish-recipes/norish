import { describe, expect, it, vi } from "vitest";

import { cardLines } from "../utils/card-lines";
import { openRow, pastOpenThreshold } from "../utils/open-row";

const row = () => ({ close: vi.fn() });

describe("openRow", () => {
  it("closes the open row on a scroll or a touch elsewhere", () => {
    const first = row();

    openRow.opened(first);
    openRow.closeOpen();
    expect(first.close).toHaveBeenCalledOnce();
  });

  it("closes the previous row when another opens", () => {
    const first = row();
    const second = row();

    openRow.opened(first);
    openRow.opened(second);
    expect(first.close).toHaveBeenCalledOnce();
    expect(second.close).not.toHaveBeenCalled();
    openRow.closed(second);
  });

  it("leaves the row the touch landed in, and forgets a row once it closed", () => {
    const first = row();

    openRow.opened(first);
    openRow.closeOpen(first);
    expect(first.close).not.toHaveBeenCalled();
    openRow.closed(first);
    openRow.closeOpen();
    expect(first.close).not.toHaveBeenCalled();
  });
});

describe("pastOpenThreshold", () => {
  it("is where a release opens the row, whichever way the card moved", () => {
    expect(pastOpenThreshold(-39)).toBe(false);
    expect(pastOpenThreshold(-40)).toBe(true);
    expect(pastOpenThreshold(52)).toBe(true);
  });
});

describe("cardLines", () => {
  it("chunks a grid's rows in pairs and a list's one by one", () => {
    expect(cardLines([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(cardLines([1, 2], 1)).toEqual([[1], [2]]);
    expect(cardLines([], 2)).toEqual([]);
  });
});
