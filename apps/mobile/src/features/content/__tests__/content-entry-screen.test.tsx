// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const held = vi.hoisted(() => ({
  alert: vi.fn(),
  router: { back: vi.fn(), push: vi.fn() },
  entry: {} as Record<string, unknown>,
  save: vi.fn(),
  remove: vi.fn(),
  setName: vi.fn(),
}));

vi.mock("react-native", async () =>
  (await import("../../../../__tests__/mocks/content-ui")).reactNative(held.alert)
);
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: () => undefined }));
vi.mock("heroui-native", () => ({ Skeleton: () => <i data-testid="skeleton" /> }));
vi.mock("@/hooks/use-cancel-button", () => ({
  useCancelButton: () => ({ text: "cancel", style: "cancel" }),
}));
vi.mock("@/lib/i18n/use-text", async () => ({
  useText: (await import("../../../../__tests__/mocks/content-ui")).echoText,
}));
vi.mock("expo-router", () => ({
  useRouter: () => held.router,
  useLocalSearchParams: () => ({ kind: "tag", id: "e1" }),
}));
vi.mock("@/components/sheet", async () =>
  (await import("../../../../__tests__/mocks/content-ui")).sheet()
);
vi.mock("@/components/modal-header", () => ({
  destructiveAction: (label: string, onPress: () => void) => ({ label, onPress }),
}));
vi.mock("@/components/sheet-input", async () => ({
  SheetInput: (await import("../../../../__tests__/mocks/content-ui")).kit.sheetInput,
}));
vi.mock("@norish/shared-react/lists", async (importActual) => ({
  ...(await importActual<object>()),
  useContentEntry: () => ({
    entry: { id: "e1", name: "Diner", recipeCount: 97 },
    detail: { access: "edit", note: null, usedKey: "recipes" },
    gone: false,
    name: "Diner",
    setName: held.setName,
    view: { action: "save", max: 50, target: null, moved: 97 },
    problem: null,
    offline: false,
    pending: false,
    canSave: true,
    deleteImpact: { recipes: 97, scope: "household" },
    deleteState: "ready",
    deleteProblem: null,
    resetDelete: vi.fn(),
    retryCount: vi.fn(),
    save: held.save,
    remove: held.remove,
    ...held.entry,
  }),
}));

const { ContentEntryScreen } = await import("../screens/content-entry-screen");

describe("ContentEntryScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.entry = {};
    held.save.mockResolvedValue(true);
    held.remove.mockResolvedValue(true);
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
      )
    ).toBeTruthy();
  });

  it("asks before deleting, with the count, in the native alert, and closes once deleted", async () => {
    render(<ContentEntryScreen />);
    fireEvent.click(screen.getByTestId("sheet-secondary-common.actions.delete"));

    const [title, body, buttons] = held.alert.mock.calls[0] as [
      string,
      string,
      { text: string; style?: string; onPress?: () => Promise<void> }[],
    ];

    expect(title).toContain("settings.content.delete.title");
    expect(body).toBe('settings.content.delete.body{"count":97}');
    expect(buttons.map((button) => button.style)).toEqual(["cancel", "destructive"]);
    expect(held.remove).not.toHaveBeenCalled();
    await act(async () => void (await buttons[1]!.onPress?.()));
    expect(held.remove).toHaveBeenCalled();
    expect(held.router.back).toHaveBeenCalled();
  });

  it("counts every household's recipes for a server entry an admin deletes", () => {
    held.entry = { deleteImpact: { recipes: 181, scope: "server" } };
    render(<ContentEntryScreen />);
    fireEvent.click(screen.getByTestId("sheet-secondary-common.actions.delete"));
    expect(held.alert.mock.calls[0]?.[1]).toBe('settings.content.delete.bodyServer{"count":181}');
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
    expect(screen.queryByTestId("sheet-secondary-common.actions.delete")).toBeNull();
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

  it("shows a skeleton while the entry is read, and says a delete went stale", () => {
    held.entry = { entry: null };
    const { unmount } = render(<ContentEntryScreen />);

    expect(screen.getByTestId("skeleton")).toBeTruthy();
    unmount();
    held.entry = { deleteProblem: "stale" };
    render(<ContentEntryScreen />);
    expect(screen.getByText("settings.content.panel.stale")).toBeTruthy();
  });

  it("closes when a housemate deletes the entry", () => {
    held.entry = { gone: true, entry: null };
    render(<ContentEntryScreen />);
    expect(held.router.back).toHaveBeenCalled();
  });
});
