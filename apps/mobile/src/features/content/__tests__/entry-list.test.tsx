// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentEntry, ContentSection } from "@norish/shared-react/lists";

import { alert } from "../../../../__tests__/mocks/content-setup";

const held = vi.hoisted(() => ({
  list: {} as Record<string, unknown>,
  setSearch: vi.fn(),
  setUnusedOnly: vi.fn(),
  retry: vi.fn(),
  impact: vi.fn(),
  remove: vi.fn(),
  showError: vi.fn(),
}));

vi.mock("@norish/shared-react/platform", () => ({
  usePlatform: () => ({ showError: held.showError }),
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
  useEntryDelete: () => ({ impact: held.impact, remove: held.remove, offline: false }),
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
const show = (
  list: Record<string, unknown>,
  onOpen = vi.fn(),
  onAdd = vi.fn(),
  which: "tags" | "cuisines" = "cuisines",
  onUses = vi.fn()
) => {
  held.list = list;
  render(<EntryList list={which} onAdd={onAdd} onOpen={onOpen} onUses={onUses} />);

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
    expect(screen.getByTestId("content-add").textContent).toBe(
      "settings.content.panel.addTitle.cuisine"
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
    expect(screen.getByTestId("content-entry-Manado").textContent).toContain(
      'settings.content.countCell{"count":3}'
    );
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

  it("heads Tags, which have no section title, with how many there are", () => {
    show(
      {
        loaded: true,
        failed: false,
        view: {
          state: "list",
          count: 3,
          sections: [section({ entries: [entry("a"), entry("b"), entry("c")] })],
        },
      },
      vi.fn(),
      vi.fn(),
      "tags"
    );
    expect(screen.getByTestId("heading-household").textContent).toBe(
      'settings.content.count.tag{"count":3}'
    );
  });

  it("keeps the heading at the whole list's count while a search matches fewer", () => {
    show(
      {
        loaded: true,
        failed: false,
        search: "a",
        view: { state: "list", count: 3, sections: [section({ entries: [entry("a")] })] },
      },
      vi.fn(),
      vi.fn(),
      "tags"
    );
    expect(screen.getByTestId("heading-household").textContent).toBe(
      'settings.content.count.tag{"count":3}'
    );
  });

  it("counts the unused tags while the unused filter is on", () => {
    show(
      {
        loaded: true,
        failed: false,
        unusedOnly: true,
        view: {
          state: "list",
          count: 2,
          sections: [section({ entries: [entry("a"), entry("b")] })],
        },
      },
      vi.fn(),
      vi.fn(),
      "tags"
    );
    expect(screen.getByTestId("heading-household").textContent).toBe(
      'settings.content.countUnused.tag{"count":2}'
    );
  });

  describe("long-press menu", () => {
    const listed = (entries: ContentEntry[], over: Record<string, unknown> = {}) => ({
      loaded: true,
      failed: false,
      view: { state: "list", sections: [section({ entries })] },
      ...over,
    });

    it("offers Show recipes, Rename and Delete on an entry the reader may edit", () => {
      const onOpen = vi.fn();
      const onUses = vi.fn();

      show(listed([entry("Diner")]), onOpen, vi.fn(), "tags", onUses);
      fireEvent.click(screen.getByTestId("content-entry-Diner-menu-uses"));
      expect(onUses).toHaveBeenCalledWith("Diner");
      fireEvent.click(screen.getByTestId("content-entry-Diner-menu-rename"));
      expect(onOpen).toHaveBeenLastCalledWith("Diner");
      expect(
        screen.getByTestId("content-entry-Diner-menu-delete").getAttribute("data-destructive")
      ).toBe("true");
    });

    it("orders the menu Rename, Show recipes, Delete", () => {
      show(listed([entry("Diner")]));
      expect(
        screen
          .getAllByTestId(/^content-entry-Diner-menu-/)
          .map((item) => item.getAttribute("data-testid"))
      ).toEqual([
        "content-entry-Diner-menu-rename",
        "content-entry-Diner-menu-uses",
        "content-entry-Diner-menu-delete",
      ]);
    });

    it("deletes from the list with the count in an alert, opening no sheet", async () => {
      const onOpen = vi.fn();

      held.impact.mockResolvedValue({ recipes: 97, scope: "household" });
      held.remove.mockResolvedValue("deleted");
      show(listed([entry("Diner", { recipeCount: 97 })]), onOpen, vi.fn(), "tags");
      await act(async () => fireEvent.click(screen.getByTestId("content-entry-Diner-menu-delete")));

      const [title, body, buttons] = alert.mock.calls[0] as [
        string,
        string,
        { text: string; style?: string; onPress?: () => Promise<void> }[],
      ];

      expect(title).toContain("settings.content.delete.title");
      expect(body).toBe('settings.content.delete.body{"count":97}');
      expect(buttons.map((button) => button.style)).toEqual(["cancel", "destructive"]);
      expect(onOpen).not.toHaveBeenCalled();
      expect(held.remove).not.toHaveBeenCalled();
      await act(async () => void (await buttons[1]!.onPress?.()));
      expect(held.remove).toHaveBeenCalledWith(expect.objectContaining({ id: "Diner" }));
    });

    it("says the count failed, asks nothing and deletes nothing", async () => {
      held.impact.mockResolvedValue(null);
      show(listed([entry("Italian", { instance: true })]), vi.fn(), vi.fn(), "cuisines");
      await act(async () =>
        fireEvent.click(screen.getByTestId("content-entry-Italian-menu-delete"))
      );
      expect(alert).not.toHaveBeenCalled();
      expect(held.remove).not.toHaveBeenCalled();
      expect(held.showError).toHaveBeenCalledWith(
        null,
        expect.any(String),
        "settings.content.delete.countFailed"
      );
    });

    it("gives a read-only entry no menu", () => {
      show(listed([entry("Italian", { instance: true, editable: false })]));
      expect(screen.queryByTestId("content-entry-Italian-menu-uses")).toBeNull();
    });

    it("offline, leaves only Show recipes", () => {
      show(listed([entry("Diner")], { offline: true }));
      expect(screen.getByTestId("content-entry-Diner-menu-uses")).toBeTruthy();
      expect(screen.queryByTestId("content-entry-Diner-menu-rename")).toBeNull();
      expect(screen.queryByTestId("content-entry-Diner-menu-delete")).toBeNull();
    });
  });
});
