/** The note panel's Save: text, day and slot as one write of only what changed. */
import type { ReactNode } from "react";
import { EditNotePanel } from "@/features/calendar/components/panels/edit-note-panel";
import { parseDate } from "@internationalized/date";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

const held = vi.hoisted(() => ({
  saveItem: vi.fn(),
  moveItem: vi.fn(),
  planNote: vi.fn(),
  deleteItem: vi.fn(),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

// The draft is the real one; only the writes it hands to are held.
vi.mock("@norish/shared-react/calendar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/calendar")>()),
  useCalendarMutations: () => held,
}));

vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null;

  Panel.Body = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return { Panel };
});

vi.mock("@/components/shared/action-button", () => ({
  ActionButton: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  ActionButtonGroup: ({ children, start }: { children: ReactNode; start: ReactNode }) => (
    <div>
      {start}
      {children}
    </div>
  ),
}));

vi.mock("@/features/calendar/components/panels/edit-planned-recipe-panel", () => ({
  DateAndSlotFields: ({
    onSelectDate,
    onSelectSlot,
  }: {
    onSelectDate: (date: ReturnType<typeof parseDate>) => void;
    onSelectSlot: (slot: string) => void;
  }) => (
    <>
      <button type="button" onClick={() => onSelectDate(parseDate("2026-11-14"))}>
        pick-day
      </button>
      <button type="button" onClick={() => onSelectSlot("Dinner")}>
        pick-dinner
      </button>
    </>
  ),
}));

vi.mock("@heroui/react", () => ({
  TextField: ({
    children,
    value,
    onChange,
  }: {
    children: ReactNode;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <div>
      <input aria-label="note" value={value} onChange={(event) => onChange(event.target.value)} />
      {children}
    </div>
  ),
  Label: () => null,
  Input: () => null,
}));

const note: PlannedItemFromQuery = {
  id: "n1",
  userId: "u1",
  date: "2026-11-12",
  slot: "Lunch",
  sortOrder: 0,
  itemType: "note",
  recipeId: null,
  title: "Leftovers",
  recipeName: null,
  recipeImage: null,
  servings: null,
  calories: null,
  version: 1,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const renderPanel = (onOpenChange = vi.fn()) => {
  render(<EditNotePanel open note={note} onOpenChange={onOpenChange} />);

  return onOpenChange;
};

describe("EditNotePanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves new text, day and slot as one write, and closes", () => {
    const onOpenChange = renderPanel();

    fireEvent.change(screen.getByLabelText("note"), { target: { value: " Leek soup " } });
    fireEvent.click(screen.getByText("pick-day"));
    fireEvent.click(screen.getByText("pick-dinner"));
    fireEvent.click(screen.getByText("save"));

    expect(held.saveItem).toHaveBeenCalledExactlyOnceWith("n1", {
      title: "Leek soup",
      date: "2026-11-14",
      slot: "Dinner",
    });
    expect(held.moveItem).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("writes only the slot when only the slot changed", () => {
    renderPanel();
    fireEvent.click(screen.getByText("pick-dinner"));
    fireEvent.click(screen.getByText("save"));

    expect(held.saveItem).toHaveBeenCalledExactlyOnceWith("n1", { slot: "Dinner" });
  });

  it("closes without a write when nothing changed", () => {
    const onOpenChange = renderPanel();

    fireEvent.click(screen.getByText("save"));

    expect(held.saveItem).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps a blank note open and unsaved", () => {
    const onOpenChange = renderPanel();

    fireEvent.change(screen.getByLabelText("note"), { target: { value: "  " } });
    fireEvent.click(screen.getByText("save"));

    expect(held.saveItem).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
