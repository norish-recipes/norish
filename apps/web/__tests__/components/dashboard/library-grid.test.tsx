import type { LibraryGridItem } from "@/lib/library-items";
import LibraryGrid from "@/components/dashboard/library-grid";
import RecipeGridSkeleton from "@/components/skeleton/recipe-grid-skeleton";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DeviceKind, RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

const device = vi.hoisted(() => ({ kind: "desktop" as DeviceKind }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/context/device-preferences-context", async () =>
  (await import("../../helpers/device-preferences-mock")).mockDevicePreferences(undefined, {
    kind: () => device.kind,
  })
);

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
}

const ITEMS: LibraryGridItem[] = Array.from({ length: 6 }, (_, i) => ({
  kind: "pending",
  id: `item-${i}`,
}));

let scrollKey = 0;

function renderGrid(variant: RecipeViewMode) {
  return render(
    <LibraryGrid
      emptyState={null}
      isFetchingMore={false}
      isLoading={false}
      items={ITEMS}
      loadMore={() => {}}
      renderItem={(item) => <span data-testid="library-item">{item.id}</span>}
      // Each render remembers its own rows, so no test restores another's layout.
      scrollKey={`library-grid-test-${scrollKey++}`}
      variant={variant}
    />
  );
}

/** The ids drawn in the first virtual row. */
function firstRow(container: HTMLElement): string[] {
  const row = container.querySelector('[data-index="0"]');

  return Array.from(row?.querySelectorAll('[data-testid="library-item"]') ?? []).map(
    (item) => item.textContent ?? ""
  );
}

describe("LibraryGrid", () => {
  it.each([
    [390, "phone", ["item-0"]],
    [1100, "desktop", ["item-0", "item-1"]],
    [1440, "desktop", ["item-0", "item-1", "item-2"]],
  ] as const)(
    "at %ipx (%s) puts the right number of list rows side by side",
    (width, kind, ids) => {
      device.kind = kind;
      setViewportWidth(width);

      const { container } = renderGrid("list");

      expect(firstRow(container)).toEqual(ids);
      expect(container.querySelector<HTMLElement>('[data-index="0"] > .grid')?.style).toMatchObject(
        {
          gridTemplateColumns: `repeat(${ids.length}, minmax(0, 1fr))`,
        }
      );
    }
  );

  it("keeps four grid cards to a row on a desktop", () => {
    device.kind = "desktop";
    setViewportWidth(1440);

    const { container } = renderGrid("grid");

    expect(firstRow(container)).toEqual(["item-0", "item-1", "item-2", "item-3"]);
  });

  it("draws every item once across the list's rows", () => {
    device.kind = "desktop";
    setViewportWidth(1440);

    renderGrid("list");

    expect(screen.getAllByTestId("library-item").map((item) => item.textContent)).toEqual(
      ITEMS.map((item) => item.id)
    );
  });
});

describe("LibraryGrid infinite scroll", () => {
  function pending(count: number): LibraryGridItem[] {
    return Array.from({ length: count }, (_, i) => ({ kind: "pending", id: `page-${i}` }));
  }

  it("asks for the next page again when a page lands and the end is still near", () => {
    device.kind = "desktop";
    setViewportWidth(1440);
    const loadMore = vi.fn();
    const grid = (items: LibraryGridItem[], isFetchingMore: boolean) => (
      <LibraryGrid
        emptyState={null}
        isFetchingMore={isFetchingMore}
        isLoading={false}
        items={items}
        loadMore={loadMore}
        renderItem={(item) => <span>{item.id}</span>}
        scrollKey={`library-grid-test-${scrollKey++}`}
        variant="list"
      />
    );

    // Three to a row: thirty items are ten rows, all within the overscan, so the end is near.
    const { rerender } = render(grid(pending(30), false));

    expect(loadMore).toHaveBeenCalledTimes(1);

    rerender(grid(pending(30), true));
    // The next page adds only five rows, so the last drawn row stays within the threshold.
    rerender(grid(pending(45), false));

    expect(loadMore).toHaveBeenCalledTimes(2);
  });
});

describe("RecipeGridSkeleton", () => {
  it.each([
    ["list", ["grid-cols-1", "lg:grid-cols-2", "xl:grid-cols-3"]],
    ["grid", ["grid-cols-2", "lg:grid-cols-4"]],
  ] as const)("lays the %s skeleton out in the library's columns", (variant, columns) => {
    const { container } = render(<RecipeGridSkeleton variant={variant} />);

    expect(container.firstElementChild).toHaveClass(...columns);
  });
});
