/**
 * The Library grid's infinite scroll: at the end of the list it asks for the next page once no
 * read is running, and it draws a spinner only for the next page.
 */

import LibraryGrid from "@/features/library/components/grid/library-grid";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@norish/shared-react/reader", () => ({ useDeviceKind: () => "phone" }));
vi.mock("@norish/shared-react/platform", () => ({ useHydrated: () => true }));
vi.mock("@/features/library/hooks", () => ({ useContainerColumns: () => 2 }));

const items = Array.from({ length: 4 }, (_, i) => ({ kind: "pending" as const, id: `r${i}` }));

function grid(props: { isFetching: boolean; isFetchingMore: boolean; loadMore: () => void }) {
  return (
    <LibraryGrid
      emptyState={null}
      isLoading={false}
      items={items}
      renderItem={(item) => <span>{item.id}</span>}
      scrollKey="test"
      variant="grid"
      {...props}
    />
  );
}

describe("LibraryGrid", () => {
  it("asks for the next page once a reread at the end of the list lands, with no spinner meanwhile", () => {
    const loadMore = vi.fn();
    const { rerender } = render(grid({ isFetching: true, isFetchingMore: false, loadMore }));

    expect(loadMore).not.toHaveBeenCalled();
    expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();

    rerender(grid({ isFetching: false, isFetchingMore: false, loadMore }));
    expect(loadMore).toHaveBeenCalledTimes(1);

    rerender(grid({ isFetching: true, isFetchingMore: true, loadMore }));
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});
