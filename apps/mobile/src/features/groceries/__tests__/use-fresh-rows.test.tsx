// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";

import { useFreshRows } from "../hooks/use-fresh-rows";
import { storeListRows } from "../utils/list-rows";

const store = {
  id: "s",
  name: "s",
  sortOrder: 0,
  color: "primary",
  aisles: [],
} as unknown as StoreDto;
const line = (id: string) =>
  ({ id, name: id, storeId: "s", isDone: false, sortOrder: 0 }) as unknown as GroceryDto;
const rowsOf = (...ids: string[]) =>
  storeListRows({
    stores: [store],
    groceries: ids.map(line),
    groups: null,
    doneOpen: new Set(),
    collapsed: new Set(),
    aisleFor: () => null,
  });

describe("useFreshRows", () => {
  it("animates no row of the first load, then only a row new to the list", () => {
    const first = rowsOf("a", "b");
    const { result, rerender } = renderHook(({ rows }) => useFreshRows(rows), {
      initialProps: { rows: first },
    });

    expect(result.current.size).toBe(0);

    const next = rowsOf("a", "b", "c");

    rerender({ rows: next });
    // The commit that mounts the new row is done, so a scroll that mounts rows again animates none.
    expect(result.current.size).toBe(0);
  });

  it("names the new row's value for the commit that mounts it", () => {
    const seen: ReadonlySet<object>[] = [];
    const { rerender } = renderHook(
      ({ rows }) => {
        const fresh = useFreshRows(rows);

        seen.push(fresh);

        return fresh;
      },
      { initialProps: { rows: rowsOf("a") } }
    );
    const next = rowsOf("a", "c");

    rerender({ rows: next });

    const added = next.find((row) => row.key === "line:c")?.value;

    expect(seen.some((fresh) => added !== undefined && fresh.has(added))).toBe(true);
    expect(seen.some((fresh) => fresh.size > 1)).toBe(false);
  });

  it("animates no row a drop reorders", () => {
    const seen: ReadonlySet<object>[] = [];
    const { rerender } = renderHook(
      ({ rows }) => {
        const fresh = useFreshRows(rows);

        seen.push(fresh);

        return fresh;
      },
      { initialProps: { rows: rowsOf("a", "b") } }
    );

    rerender({ rows: rowsOf("b", "a") });
    expect(seen.every((fresh) => fresh.size === 0)).toBe(true);
  });
});
