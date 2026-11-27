import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { ListRow } from "@/components/shared/list-row";
import { IngredientList } from "@/features/ingredients/components/ingredient-list";

vi.mock("@tanstack/react-virtual", () => ({
  useWindowVirtualizer: () => ({
    getTotalSize: () => 120,
    measureElement: () => {},
    getVirtualItems: () => [
      { index: 0, start: 0 },
      { index: 1, start: 60 },
    ],
  }),
}));

vi.mock("@/features/ingredients/components/ingredient-row", () => ({
  IngredientRow: ({ item, ...rest }: { item: { name: string }; index: number; offset: number }) => (
    <ListRow
      data-testid="ingredient-row"
      detail="x"
      name={item.name}
      offset={rest.offset}
      rowData={{ "data-index": rest.index }}
      onPress={() => {}}
    />
  ),
}));

const row = (id: string) => ({
  item: { id, name: id },
  depth: 0,
  expanded: false,
  loading: false,
});

describe("IngredientList", () => {
  it("is one list whose rows are its own list items", () => {
    render(
      <IngredientList
        hasMore={false}
        isFetchingMore={false}
        loadMore={() => {}}
        rows={[row("a"), row("b")] as never}
        settling={false}
        onOpen={() => {}}
      />
    );

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");

    expect(items).toHaveLength(2);
    for (const item of items) expect(item.parentElement).toBe(list);
    expect(list.tagName).toBe("UL");
  });
});
