// @vitest-environment jsdom
/** The Content page's kinds of place: a counted row, a list heading, a sheet note. Each owns its spacing. */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "../mocks/content-setup";

vi.mock("@/components/search-filter-row", () => ({
  SearchFilterRow: ({ testID }: { testID: string }) => <i data-testid={testID} />,
}));

const { CountRow } = await import("@/components/count-row");
const { ListHeading } = await import("@/components/list-heading");
const { SheetNote } = await import("@/components/sheet-note");
const { ListFrame } = await import("@/components/list-frame");
const { sectionRows } = await import("@/components/section-rows");

describe("CountRow", () => {
  it("shows the name and count, and presses when it has a press", () => {
    const onPress = vi.fn();

    render(<CountRow count="3 recipes" name="Diner" testID="row" onPress={onPress} />);
    expect(screen.getByTestId("row").textContent).toBe("Diner3 recipes");
    fireEvent.click(screen.getByTestId("row"));
    expect(onPress).toHaveBeenCalled();
  });

  it("names its lock mark for a screen reader where the entry is read-only", () => {
    render(<CountRow lockLabel="Read only" name="Italian" />);
    expect(screen.getByLabelText("Read only")).toBeTruthy();
  });
});

describe("CountRow in a tree", () => {
  it("folds with its own button, not by opening the row", () => {
    const onFold = vi.fn();
    const onPress = vi.fn();
    const fold = {
      foldable: true,
      expanded: false,
      label: "Expand",
      testID: "fold",
      onPress: onFold,
    };

    render(<CountRow depth={1} fold={fold} name="Rice" testID="row" onPress={onPress} />);
    fireEvent.click(screen.getByTestId("fold"));
    expect(onFold).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("leaves the fold button off a kind that has none, and ends in a trailing node", () => {
    const fold = {
      foldable: false,
      expanded: false,
      label: "Expand",
      testID: "fold",
      onPress: vi.fn(),
    };

    render(<CountRow fold={fold} name="Basmati" trailing={<i data-testid="end" />} />);
    expect(screen.getByTestId("fold")).toHaveProperty("disabled", true);
    expect(screen.getByTestId("end")).toBeTruthy();
  });
});

describe("ListHeading", () => {
  it("shows its title", () => {
    render(<ListHeading testID="h" title="Built in" />);
    expect(screen.getByTestId("h").textContent).toBe("Built in");
  });

  it("puts its help behind a labelled button", () => {
    render(<ListHeading help="Kept by your admin" title="From your server" />);
    expect(screen.getByLabelText("Kept by your admin")).toBeTruthy();
  });
});

describe("SheetNote", () => {
  it("is plain text", () => {
    render(<SheetNote testID="note">Not saved</SheetNote>);
    expect(screen.getByTestId("note").textContent).toBe("Not saved");
  });
});

describe("sectionRows", () => {
  it("puts a heading row before the items of a section that has one, the first marked", () => {
    const rows = sectionRows(
      [
        { key: "a", section: "A", heading: true, items: ["x", "y"] },
        { key: "b", section: "B", heading: false, items: ["z"] },
        { key: "c", section: "C", heading: true, items: [] },
      ],
      (item) => item
    );

    expect(rows.map((row) => row.key)).toEqual(["heading-a", "x", "y", "z", "heading-c"]);
    expect(rows.map((row) => (row.type === "heading" ? row.first : row.index))).toEqual([
      true,
      0,
      1,
      0,
      false,
    ]);
  });
});

describe("ListFrame", () => {
  const search = { label: "Search", testID: "search", value: "", onChange: vi.fn() };
  const frame = (props: Partial<React.ComponentProps<typeof ListFrame<string>>> = {}) =>
    render(
      <ListFrame
        data={["one"]}
        keyExtractor={(row) => row}
        loading={false}
        renderItem={({ item }) => <i data-testid={`row-${item}`} />}
        search={search}
        testID="list"
        {...props}
      />
    );

  it("is a skeleton while it loads, and Retry when it failed", () => {
    const onRetry = vi.fn();
    const loading = frame({ loading: true });

    expect(screen.getByTestId("list-skeleton")).toBeTruthy();
    loading.unmount();
    frame({ failed: { title: "Failed", onRetry } });
    fireEvent.click(screen.getByTestId("list-retry"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("draws the search, what `above` adds and the rows, or a card when nothing is found", () => {
    const ready = frame({ above: <i data-testid="above" /> });

    expect(screen.getByTestId("search")).toBeTruthy();
    expect(screen.getByTestId("above")).toBeTruthy();
    expect(screen.getByTestId("row-one")).toBeTruthy();
    ready.unmount();
    frame({ nothing: { icon: "leaf-outline", testID: "none", title: "None" } });
    expect(screen.getByTestId("none")).toBeTruthy();
  });
});
