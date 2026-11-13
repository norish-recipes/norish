import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEFAULT_PERSISTED_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

import type { PlatformStorage } from "../../platform";
import {
  RECIPE_FILTERS_STORAGE_KEY,
  useLibraryFiltersPersistence,
} from "../library-filters-persistence";
import { LibraryFiltersProvider, useLibraryFiltersStoreApi } from "../library-filters-store";

const wrapper = ({ children }: { children: ReactNode }) => (
  <LibraryFiltersProvider initial={undefined}>{children}</LibraryFiltersProvider>
);

function memoryStorage(initial: Record<string, string>, asynchronous = false) {
  const values = { ...initial };
  const storage: PlatformStorage = {
    getItem: (key) => (asynchronous ? Promise.resolve(values[key] ?? null) : (values[key] ?? null)),
    setItem: (key, value) => {
      values[key] = value;
    },
    removeItem: (key) => {
      delete values[key];
    },
  };

  return { storage, values };
}

const stored = (sortMode: string) =>
  JSON.stringify({ ...DEFAULT_PERSISTED_RECIPE_FILTERS, sortMode });

function render(storage: PlatformStorage, resumed = false) {
  return renderHook(
    () => {
      useLibraryFiltersPersistence({ storage, resumed });

      return useLibraryFiltersStoreApi();
    },
    { wrapper }
  );
}

describe("useLibraryFiltersPersistence", () => {
  it("applies the stored filters at once from a synchronous storage", () => {
    const { storage } = memoryStorage({ [RECIPE_FILTERS_STORAGE_KEY]: stored("titleAsc") });
    const { result } = render(storage);

    expect(result.current.getState().filters.sortMode).toBe("titleAsc");
    expect(result.current.getState().hydrated).toBe(true);
  });

  it("waits for an asynchronous storage and never overwrites it with the defaults", async () => {
    const { storage, values } = memoryStorage(
      { [RECIPE_FILTERS_STORAGE_KEY]: stored("titleAsc") },
      true
    );
    const { result } = render(storage);

    expect(result.current.getState().hydrated).toBe(false);
    expect(values[RECIPE_FILTERS_STORAGE_KEY]).toBe(stored("titleAsc"));
    await waitFor(() => expect(result.current.getState().hydrated).toBe(true));
    expect(result.current.getState().filters.sortMode).toBe("titleAsc");
  });

  it("writes each change back without the search text", () => {
    const { storage, values } = memoryStorage({});
    const { result } = render(storage);

    act(() => result.current.getState().setFilters({ sortMode: "dateAsc", rawInput: "soup" }));

    const written = JSON.parse(values[RECIPE_FILTERS_STORAGE_KEY]!);

    expect(written.sortMode).toBe("dateAsc");
    expect(written).not.toHaveProperty("rawInput");
  });

  it("starts from the defaults when storage throws on read", () => {
    const { storage } = memoryStorage({});
    const throwing: PlatformStorage = {
      ...storage,
      getItem: () => {
        throw new Error("denied");
      },
    };
    const { result } = render(throwing);

    expect(result.current.getState().hydrated).toBe(true);
  });

  it("starts from the defaults when an asynchronous storage rejects", async () => {
    const { storage } = memoryStorage({});
    const rejecting: PlatformStorage = {
      ...storage,
      getItem: () => Promise.reject(new Error("x")),
    };
    const { result } = render(rejecting);

    await waitFor(() => expect(result.current.getState().hydrated).toBe(true));
  });

  it("leaves storage unread for a resumed store", () => {
    const { storage } = memoryStorage({ [RECIPE_FILTERS_STORAGE_KEY]: stored("titleAsc") });
    const { result } = render(storage, true);

    expect(result.current.getState().filters.sortMode).not.toBe("titleAsc");
  });
});
