// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { alert } from "../../../../__tests__/mocks/content-setup";

const held = vi.hoisted(() => ({
  params: { kind: "tag", id: "e1" } as Record<string, string>,
  router: { back: vi.fn(), push: vi.fn() },
  entry: {} as Record<string, unknown>,
  save: vi.fn(),
  remove: vi.fn(),
  setName: vi.fn(),
  retry: vi.fn(),
  impact: vi.fn(),
  showError: vi.fn(),
}));

vi.mock("@norish/shared-react/platform", () => ({
  usePlatform: () => ({ showError: held.showError }),
}));

vi.mock("expo-router", () => ({
  useRouter: () => held.router,
  useLocalSearchParams: () => held.params,
}));
vi.mock("@norish/shared-react/lists", async (importActual) => ({
  ...(await importActual<object>()),
  useContentEntry: () => ({
    entry: { id: "e1", name: "Diner", recipeCount: 97 },
    detail: { access: "edit", note: null, usedKey: "recipes" },
    gone: false,
    failed: false,
    retry: held.retry,
    name: "Diner",
    setName: held.setName,
    view: { action: "save", max: 50, target: null, moved: 97 },
    problem: null,
    offline: false,
    pending: false,
    canSave: true,
    save: held.save,
    ...held.entry,
  }),
  useEntryDelete: () => ({ impact: held.impact, remove: held.remove, offline: false }),
}));

vi.mock("@/components/sheet-note", () => ({
  SheetNote: ({ children, tone }: { children: React.ReactNode; tone?: string }) => (
    <p data-tone={tone}>{children}</p>
  ),
}));

const { ContentEntryScreen } = await import("../screens/content-entry-screen");

describe("ContentEntryScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.params = { kind: "tag", id: "e1" };
    held.entry = {};
    held.save.mockResolvedValue(true);
    held.remove.mockResolvedValue("deleted");
    held.impact.mockResolvedValue({ recipes: 97, scope: "household" });
  });

  it("saves the name and closes", async () => {
    render(<ContentEntryScreen />);
    expect(screen.getByTestId("sheet-confirm").textContent).toBe("common.actions.save");
    await act(async () => fireEvent.click(screen.getByTestId("sheet-confirm")));
    expect(held.save).toHaveBeenCalled();
    expect(held.router.back).toHaveBeenCalled();
  });

  it("stays open when the save did not go through", async () => {
    held.save.mockResolvedValue(false);
    render(<ContentEntryScreen />);
    await act(async () => fireEvent.click(screen.getByTestId("sheet-confirm")));
    expect(held.router.back).not.toHaveBeenCalled();
  });

  it("becomes Merge, and says what the merge moves, when the name folds onto another entry", () => {
    held.entry = {
      view: { action: "merge", max: 50, target: { id: "e2", name: "dinner" }, moved: 97 },
    };
    render(<ContentEntryScreen />);
    expect(screen.getByTestId("sheet-confirm").textContent).toBe(
      "settings.content.panel.mergeAction"
    );
    expect(
      screen.getByText(
        /settings.content.panel.merge\{"target":"dinner","name":"Diner","count":97\}/
      ).dataset.tone
    ).toBeUndefined();
  });

  it("saves a rename on Return, but leaves a merge to the header's button", async () => {
    const { unmount } = render(<ContentEntryScreen />);

    await act(async () =>
      fireEvent.keyDown(screen.getByTestId("content-entry-name"), { key: "Enter" })
    );
    expect(held.save).toHaveBeenCalledTimes(1);
    unmount();
    held.entry = {
      view: { action: "merge", max: 50, target: { id: "e2", name: "dinner" }, moved: 97 },
    };
    render(<ContentEntryScreen />);
    await act(async () =>
      fireEvent.keyDown(screen.getByTestId("content-entry-name"), { key: "Enter" })
    );
    expect(held.save).toHaveBeenCalledTimes(1);
  });

  it("asks before deleting, with the count, in the native alert, and closes once deleted", async () => {
    render(<ContentEntryScreen />);
    await act(async () =>
      fireEvent.click(screen.getByTestId("sheet-secondary-settings.content.delete.action.tag"))
    );

    const [title, body, buttons] = alert.mock.calls[0] as [
      string,
      string,
      { text: string; style?: string; onPress?: () => Promise<void> }[],
    ];

    expect(title).toContain("settings.content.delete.title");
    expect(body).toBe('settings.content.delete.body{"count":97}');
    expect(buttons.map((button) => button.style)).toEqual(["cancel", "destructive"]);
    expect(buttons[1]?.text).toBe("settings.content.delete.action.tag");
    expect(held.remove).not.toHaveBeenCalled();
    await act(async () => void (await buttons[1]!.onPress?.()));
    expect(held.remove).toHaveBeenCalled();
    expect(held.router.back).toHaveBeenCalled();
  });

  it("counts every household's recipes for a server entry an admin deletes", async () => {
    held.impact.mockResolvedValue({ recipes: 181, scope: "server" });
    render(<ContentEntryScreen />);
    await act(async () =>
      fireEvent.click(screen.getByTestId("sheet-secondary-settings.content.delete.action.tag"))
    );
    expect(alert.mock.calls[0]?.[1]).toBe('settings.content.delete.bodyServer{"count":181}');
  });

  it("is read-only for a member: no Save, no Delete, a locked note, and the name cannot be typed", () => {
    held.entry = {
      detail: {
        access: "readOnly",
        note: { key: "panel.serverReadOnly", locked: true },
        usedKey: "recipes",
      },
    };
    render(<ContentEntryScreen />);
    expect(screen.queryByTestId("sheet-confirm")).toBeNull();
    expect(screen.queryByTestId("sheet-secondary-settings.content.delete.action.tag")).toBeNull();
    expect(screen.getByText("settings.content.panel.serverReadOnly")).toBeTruthy();
    expect((screen.getByTestId("content-entry-name") as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByRole("heading").textContent).toBe("Diner");
  });

  it("opens Used by", () => {
    render(<ContentEntryScreen />);
    fireEvent.click(screen.getByTestId("content-entry-used"));
    expect(held.router.push).toHaveBeenCalledWith({
      pathname: "/settings/content-uses",
      params: { kind: "tag", id: "e1" },
    });
  });

  it("shows a skeleton while the entry is read", () => {
    held.entry = { entry: null };
    render(<ContentEntryScreen />);
    expect(screen.getByTestId("skeleton")).toBeTruthy();
  });

  it("says a delete went stale or failed, and stays open", async () => {
    held.remove.mockResolvedValue("stale");
    render(<ContentEntryScreen />);
    await act(async () =>
      fireEvent.click(screen.getByTestId("sheet-secondary-settings.content.delete.action.tag"))
    );

    const [, , buttons] = alert.mock.calls[0] as [
      string,
      string,
      { onPress?: () => Promise<void> }[],
    ];

    await act(async () => void (await buttons[1]!.onPress?.()));
    expect(held.showError).toHaveBeenCalledWith(
      null,
      expect.any(String),
      "settings.content.panel.stale"
    );
    expect(held.router.back).not.toHaveBeenCalled();
  });

  it("says the count failed, asks nothing and deletes nothing", async () => {
    held.impact.mockResolvedValue(null);
    render(<ContentEntryScreen />);
    await act(async () =>
      fireEvent.click(screen.getByTestId("sheet-secondary-settings.content.delete.action.tag"))
    );
    expect(alert).not.toHaveBeenCalled();
    expect(held.remove).not.toHaveBeenCalled();
    expect(held.showError).toHaveBeenCalledWith(
      null,
      expect.any(String),
      "settings.content.delete.countFailed"
    );
  });

  it("closes when a housemate deletes the entry", () => {
    held.entry = { gone: true, entry: null };
    render(<ContentEntryScreen />);
    expect(held.router.back).toHaveBeenCalled();
  });

  it("leaves the sheet when the kind of the route is unknown", () => {
    held.params = { kind: "ingredients", id: "e1" };
    render(<ContentEntryScreen />);
    expect(held.router.back).toHaveBeenCalled();
    expect(screen.queryByTestId("content-entry-sheet")).toBeNull();
  });

  it("says the list could not be read, not a skeleton forever, and Retry reads it again", () => {
    held.entry = { entry: null, detail: null, view: null, failed: true };
    render(<ContentEntryScreen />);
    expect(screen.queryByTestId("skeleton")).toBeNull();
    fireEvent.click(screen.getByTestId("content-entry-retry"));
    expect(held.retry).toHaveBeenCalled();
  });
});
