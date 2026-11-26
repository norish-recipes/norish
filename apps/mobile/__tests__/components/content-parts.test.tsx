// @vitest-environment jsdom
/** The Content page's kinds of place: a counted row, a list heading, a sheet note. Each owns its spacing. */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "../mocks/content-setup";

const { CountRow } = await import("@/components/count-row");
const { ListHeading } = await import("@/components/list-heading");
const { SheetNote } = await import("@/components/sheet-note");
const { OnSheet } = await import("@/components/on-sheet");

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

describe("ListHeading", () => {
  it("carries the page's side inset, and none on a sheet, whose body owns it", () => {
    const page = render(<ListHeading testID="h" title="Built in" />);

    expect(screen.getByTestId("h")).toBeTruthy();
    page.unmount();
    render(
      <OnSheet value>
        <ListHeading testID="h" title="Built in" />
      </OnSheet>
    );
    expect(screen.getByTestId("h")).toBeTruthy();
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
