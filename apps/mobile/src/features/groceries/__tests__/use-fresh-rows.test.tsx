// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";

import type { ListRow } from "../utils/list-rows";
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
    const { result, rerender } = renderHook(({ rows }) => useFreshRows(rows, true), {
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
        const fresh = useFreshRows(rows, true);

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
        const fresh = useFreshRows(rows, true);

        seen.push(fresh);

        return fresh;
      },
      { initialProps: { rows: rowsOf("a", "b") } }
    );

    rerender({ rows: rowsOf("b", "a") });
    expect(seen.every((fresh) => fresh.size === 0)).toBe(true);
  });

  it("animates no row the list showed before, when a filter or a fold brings it back", () => {
    const seen: ReadonlySet<object>[] = [];
    const { rerender } = renderHook(
      ({ rows }) => {
        const fresh = useFreshRows(rows, true);

        seen.push(fresh);

        return fresh;
      },
      { initialProps: { rows: rowsOf("a", "b") } }
    );

    rerender({ rows: rowsOf("a") });
    rerender({ rows: rowsOf("a", "c") });
    seen.length = 0;
    rerender({ rows: rowsOf("a", "b", "c") });
    expect(seen.every((fresh) => fresh.size === 0)).toBe(true);
  });

  it("animates the first row into a list that was empty", () => {
    const seen: ReadonlySet<object>[] = [];
    const { rerender } = renderHook(
      ({ rows }) => {
        const fresh = useFreshRows(rows, true);

        seen.push(fresh);

        return fresh;
      },
      { initialProps: { rows: [] as ListRow[] } }
    );
    const next = rowsOf("a");

    rerender({ rows: next });

    const added = next.find((row) => row.key === "line:a")?.value;

    expect(seen.some((fresh) => added !== undefined && fresh.has(added))).toBe(true);
  });

  it("animates no row of the first load that follows the empty list shown while loading", () => {
    const { result, rerender } = renderHook(({ rows, loaded }) => useFreshRows(rows, loaded), {
      initialProps: { rows: [] as ListRow[], loaded: false },
    });

    rerender({ rows: rowsOf("a", "b"), loaded: true });
    expect(result.current.size).toBe(0);
  });
});
