// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useFreshRows } from "../../src/hooks/use-fresh-rows";

type Row = { kind: "item"; key: string; value: object };

const rowsOf = (...ids: string[]): Row[] =>
  ids.map((id) => ({ kind: "item", key: `line:${id}`, value: { id } }));

describe("useFreshRows", () => {
  it("animates no row of the first load, then only a row new to the list", () => {
    const first = rowsOf("a", "b");
    const { result, rerender } = renderHook(({ rows }) => useFreshRows(rows, true), {
      initialProps: { rows: first },
    });

    expect(result.current.fresh.size).toBe(0);

    const next = rowsOf("a", "b", "c");

    rerender({ rows: next });
    // The commit that mounts the new row is done, so a scroll that mounts rows again animates none.
    expect(result.current.fresh.size).toBe(0);
  });

  it("names the new row's value for the commit that mounts it", () => {
    const seen: ReadonlySet<object>[] = [];
    const { rerender } = renderHook(
      ({ rows }) => {
        const { fresh } = useFreshRows(rows, true);

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
        const { fresh } = useFreshRows(rows, true);

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
        const { fresh } = useFreshRows(rows, true);

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
        const { fresh } = useFreshRows(rows, true);

        seen.push(fresh);

        return fresh;
      },
      { initialProps: { rows: [] as Row[] } }
    );
    const next = rowsOf("a");

    rerender({ rows: next });

    const added = next.find((row) => row.key === "line:a")?.value;

    expect(seen.some((fresh) => added !== undefined && fresh.has(added))).toBe(true);
  });

  it("animates no row of the first load that follows the empty list shown while loading", () => {
    const { result, rerender } = renderHook(({ rows, loaded }) => useFreshRows(rows, loaded), {
      initialProps: { rows: [] as Row[], loaded: false },
    });

    rerender({ rows: rowsOf("a", "b"), loaded: true });
    expect(result.current.fresh.size).toBe(0);
  });

  it("animates no row that arrives with a new epoch, such as the days a list grew by", () => {
    const seen: ReadonlySet<object>[] = [];
    const { rerender } = renderHook(
      ({ rows, epoch }) => {
        const { fresh } = useFreshRows(rows, true, epoch);

        seen.push(fresh);

        return fresh;
      },
      { initialProps: { rows: rowsOf("a"), epoch: "7..21" } }
    );

    rerender({ rows: rowsOf("z", "a", "b"), epoch: "1..28" });
    expect(seen.every((fresh) => fresh.size === 0)).toBe(true);

    rerender({ rows: rowsOf("z", "a", "b", "c"), epoch: "1..28" });
    expect(seen.some((fresh) => fresh.size === 1)).toBe(true);
  });

  it("leaves the commit a new epoch lands in unsettled, and settles it once that commit is done", () => {
    const settled: boolean[] = [];
    const { result, rerender } = renderHook(
      ({ rows, epoch }) => {
        const shown = useFreshRows(rows, true, epoch);

        settled.push(shown.settled);

        return shown;
      },
      { initialProps: { rows: rowsOf("a"), epoch: "7..21" } }
    );

    expect(settled).not.toContain(false);
    rerender({ rows: rowsOf("z", "a"), epoch: "1..28" });

    expect(settled).toContain(false);
    expect(result.current.settled).toBe(true);
  });
});
