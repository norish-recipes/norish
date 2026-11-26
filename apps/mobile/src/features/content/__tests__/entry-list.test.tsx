// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentEntry, ContentSection } from "@norish/shared-react/lists";

import "../../../../__tests__/mocks/content-setup";

const held = vi.hoisted(() => ({
  list: {} as Record<string, unknown>,
  setSearch: vi.fn(),
  setUnusedOnly: vi.fn(),
  retry: vi.fn(),
}));

vi.mock("@/components/search-filter-row", async () => {
  const { createElement } = await import("react");

  return {
    SearchFilterRow: ({
      filter,
      onChange,
    }: {
      filter: { active: boolean; items: { key: string; onPress: () => void }[] };
      onChange: (value: string) => void;
    }) =>
      createElement(
        "div",
        { "data-active": filter.active },
        createElement("input", {
          "data-testid": "search",
          onChange: (event: { target: { value: string } }) => onChange(event.target.value),
        }),
        filter.items.map((item) =>
          createElement("button", {
            key: item.key,
            "data-testid": `filter-${item.key}`,
            onClick: item.onPress,
          })
        )
      ),
  };
});
vi.mock("@norish/shared-react/lists", async (importActual) => ({
  ...(await importActual<object>()),
  useContentList: () => ({
    retry: held.retry,
    setSearch: held.setSearch,
    setUnusedOnly: held.setUnusedOnly,
    search: "",
    unusedOnly: false,
    offline: false,
    ...held.list,
  }),
}));

const { EntryList } = await import("../components/entry-list");

const entry = (id: string, over: Partial<ContentEntry> = {}) =>
  ({
    id,
    name: id,
    recipeCount: 3,
    editable: true,
    instance: false,
    version: 1,
    ...over,
  }) as ContentEntry;
const section = (over: Partial<ContentSection>): ContentSection => ({
  scope: "household",
  title: null,
  help: null,
  entries: [],
  ...over,
});
const show = (list: Record<string, unknown>, onOpen = vi.fn(), onAdd = vi.fn()) => {
  held.list = list;
  render(<EntryList list="cuisines" onAdd={onAdd} onOpen={onOpen} />);

  return { onOpen, onAdd };
};

describe("EntryList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is a skeleton until the list is read", () => {
    show({ loaded: false, failed: false, view: { sections: [], state: "list" } });
    expect(screen.getByTestId("content-skeleton")).toBeTruthy();
  });

  it("says the read failed, and Retry reads it again", () => {
    show({ loaded: false, failed: true, view: { sections: [], state: "list" } });
    fireEvent.click(screen.getByTestId("content-retry"));
    expect(held.retry).toHaveBeenCalled();
  });

  it("offers Add when the list has nothing", () => {
    const { onAdd } = show({ loaded: true, failed: false, view: { sections: [], state: "empty" } });

    expect(screen.getByTestId("content-empty").textContent).toContain(
      "settings.content.empty.cuisines"
    );
    fireEvent.click(screen.getByTestId("content-add"));
    expect(onAdd).toHaveBeenCalled();
  });

  it("lists the household's entries and the server's under their own headings, the server's read-only", () => {
    const { onOpen } = show({
      loaded: true,
      failed: false,
      view: {
        state: "list",
        sections: [
          section({ title: "ownCuisines", entries: [entry("Manado")] }),
          section({
            scope: "instance",
            title: "server",
            help: "server",
            entries: [entry("Italian", { instance: true, editable: false })],
          }),
        ],
      },
    });

    expect(screen.getByTestId("heading-household").textContent).toContain(
      "settings.content.sections.ownCuisines"
    );
    expect(screen.getByTestId("heading-instance").textContent).toContain(
      "settings.content.sections.server"
    );
    expect(screen.getByTestId("content-entry-Manado").textContent).toContain('"count":3');
    expect(
      within(screen.getByTestId("content-entry-Italian")).getByLabelText(
        "settings.content.readOnly"
      )
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("content-entry-Manado")).queryByLabelText(
        "settings.content.readOnly"
      )
    ).toBeNull();
    fireEvent.click(screen.getByTestId("content-entry-Italian"));
    expect(onOpen).toHaveBeenCalledWith("Italian");
  });

  it("searches, filters to the unused, and says when nothing is unused or nothing matches", () => {
    show({
      loaded: true,
      failed: false,
      unusedOnly: true,
      view: { state: "nothingUnused", sections: [] },
    });
    fireEvent.change(screen.getByTestId("search"), { target: { value: "ita" } });
    expect(held.setSearch).toHaveBeenCalledWith("ita");
    fireEvent.click(screen.getByTestId("filter-unused"));
    expect(held.setUnusedOnly).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByTestId("filter-all"));
    expect(held.setUnusedOnly).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("content-nothingUnused")).toBeTruthy();
  });
});
