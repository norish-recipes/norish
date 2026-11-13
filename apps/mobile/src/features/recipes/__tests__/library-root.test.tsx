// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const values = new Map<string, string>();

vi.mock("@norish/shared-react/platform", () => ({
  usePlatform: () => ({
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
    },
  }),
}));

const { LibraryRoot } = await import("@/features/recipes/components/library-root");
const { useLibraryFilters, useLibraryFiltersStoreApi, RECIPE_FILTERS_STORAGE_KEY } =
  await import("@norish/shared-react/recipes");
const { DEFAULT_PERSISTED_RECIPE_FILTERS } =
  await import("@norish/shared/contracts/filter-contract");

const wrapper = ({ children }: { children: ReactNode }) => <LibraryRoot>{children}</LibraryRoot>;
const render = () =>
  renderHook(
    () => ({
      store: useLibraryFiltersStoreApi(),
      sort: useLibraryFilters((s) => s.filters.sortMode),
    }),
    {
      wrapper,
    }
  );

describe("LibraryRoot", () => {
  it("starts on the filters kept on the device", () => {
    values.set(
      RECIPE_FILTERS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_PERSISTED_RECIPE_FILTERS, sortMode: "titleAsc" })
    );

    expect(render().result.current.sort).toBe("titleAsc");
  });

  it("writes a change to the device and keeps it across a remount", () => {
    values.clear();
    const first = render();

    act(() => first.result.current.store.getState().setFilters({ sortMode: "dateAsc" }));
    expect(JSON.parse(values.get(RECIPE_FILTERS_STORAGE_KEY)!).sortMode).toBe("dateAsc");

    first.unmount();
    // The tRPC provider remounts the tree on a session change; storage is not read again.
    values.clear();

    expect(render().result.current.sort).toBe("dateAsc");
  });
});
