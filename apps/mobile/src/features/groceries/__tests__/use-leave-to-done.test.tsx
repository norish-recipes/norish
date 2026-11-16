// @vitest-environment jsdom
import type { ExitAnimationsValues } from "react-native-reanimated";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";

import type { ListItem } from "../utils/list-rows";
import { useLeaveToDone } from "../hooks/use-leave-to-done";
import { sectionKeyOf, storeListRows } from "../utils/list-rows";

vi.mock("react-native-reanimated", () => import("../../../../__tests__/mocks/reanimated"));

const store = {
  id: "s",
  name: "s",
  sortOrder: 0,
  color: "primary",
  aisles: [],
} as unknown as StoreDto;
const line = (id: string, isDone = false) =>
  ({ id, name: id, storeId: "s", isDone, sortOrder: 0 }) as unknown as GroceryDto;
const rowsOf = (...groceries: GroceryDto[]) =>
  storeListRows({
    stores: [store],
    groceries,
    groups: null,
    doneOpen: new Set(),
    collapsed: new Set(),
    aisleFor: () => null,
  });
const itemOf = (rows: ReturnType<typeof rowsOf>, key: string) =>
  rows.flatMap((row) =>
    row.kind === "item" && row.value.key === key ? [row.value] : []
  )[0] as ListItem;
/** A view at window `y`, `height` tall. */
const viewAt = (y: number, height: number) => ({
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) =>
    cb(0, y, 300, height),
});
/** The leaving row's translateY: `values` is where it sits, 50 pt tall. */
const leaveFrom = (exiting: (values: ExitAnimationsValues) => unknown, y: number) => {
  const { animations } = exiting({
    currentGlobalOriginY: y,
    currentHeight: 50,
  } as unknown as ExitAnimationsValues) as { animations: { transform: { translateY: number }[] } };

  return animations.transform[0]?.translateY;
};

afterEach(() => vi.useRealTimers());

describe("useLeaveToDone", () => {
  it("aims at the Done row where it will be once the ticked row has left above it", () => {
    const rows = rowsOf(line("a"), line("b", true));
    const { result } = renderHook(() => useLeaveToDone(rows));

    result.current.doneRef(sectionKeyOf("s"))(viewAt(500, 44));
    result.current.leaveThen(itemOf(rows, "a"), true, () => {});

    // The Done row's middle, 522, moves up by the leaving row's 50.
    expect(leaveFrom(result.current.exitingFor("a"), 300)).toBe(472 - 300 - 25);
  });

  it("aims at the slot the last open row leaves when the Done row is still to appear", () => {
    const rows = rowsOf(line("a"), line("b"));
    const { result } = renderHook(() => useLeaveToDone(rows));

    result.current.itemRef("b")(viewAt(400, 50));
    result.current.leaveThen(itemOf(rows, "b"), true, () => {});

    // The Done row takes b's slot: its middle is 22 below b's top.
    expect(leaveFrom(result.current.exitingFor("b"), 400)).toBe(422 - 400 - 25);
  });

  it("leaves no timer behind when the list unmounts", () => {
    vi.useFakeTimers();
    const rows = rowsOf(line("a"), line("b", true));
    const { result, unmount } = renderHook(() => useLeaveToDone(rows));

    result.current.doneRef(sectionKeyOf("s"))(viewAt(500, 44));
    result.current.leaveThen(itemOf(rows, "a"), true, () => {});
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
