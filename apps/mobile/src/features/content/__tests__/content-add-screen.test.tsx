// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "../../../../__tests__/mocks/content-setup";

const held = vi.hoisted(() => ({
  params: { kind: "cuisine", id: "e1" } as Record<string, string>,
  router: { back: vi.fn(), replace: vi.fn() },
  add: {} as Record<string, unknown>,
  doAdd: vi.fn(),
  setForServer: vi.fn(),
  retry: vi.fn(),
}));

vi.mock("expo-router", () => ({
  useRouter: () => held.router,
  useLocalSearchParams: () => held.params,
}));
vi.mock("@norish/shared-react/lists", async (importActual) => ({
  ...(await importActual<object>()),
  useContentAdd: () => ({
    typed: "ital",
    setTyped: vi.fn(),
    forServer: false,
    setForServer: held.setForServer,
    canAddForServer: false,
    matches: [],
    offer: { kind: "create", name: "ital" },
    problem: null,
    max: undefined,
    offline: false,
    canAdd: true,
    retry: held.retry,
    add: held.doAdd,
    ...held.add,
  }),
}));

const { ContentAddScreen } = await import("../screens/content-add-screen");

describe("ContentAddScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.params = { kind: "cuisine", id: "e1" };
    held.add = {};
  });

  it("adds the typed name and closes when it was made", async () => {
    held.doAdd.mockResolvedValue({ entry: { id: "n1" }, created: true });
    render(<ContentAddScreen />);
    await act(async () => fireEvent.click(screen.getByTestId("sheet-confirm")));
    expect(held.router.back).toHaveBeenCalled();
  });

  it("opens the entry the server found instead of making one", async () => {
    held.doAdd.mockResolvedValue({ entry: { id: "x1" }, created: false });
    render(<ContentAddScreen />);
    await act(async () => fireEvent.click(screen.getByTestId("sheet-confirm")));
    expect(held.router.replace).toHaveBeenCalledWith({
      pathname: "/settings/content-entry",
      params: { kind: "cuisine", id: "x1" },
    });
  });

  it("offers no Add where an entry folds alike, and lists the matches as you type", () => {
    held.add = {
      canAdd: false,
      matches: [{ id: "m1", name: "Italian", recipeCount: 63 }],
    };
    render(<ContentAddScreen />);
    expect((screen.getByTestId("sheet-confirm") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("content-add-match"));
    expect(held.router.replace).toHaveBeenCalledWith({
      pathname: "/settings/content-entry",
      params: { kind: "cuisine", id: "m1" },
    });
  });

  it("lets an admin pick the household's or the server's list for a Cuisine", () => {
    held.add = { canAddForServer: true };
    render(<ContentAddScreen />);
    fireEvent.click(screen.getByTestId("content-add-server"));
    expect(held.setForServer).toHaveBeenCalledWith(true);
  });

  it("says the lists could not be read, with Retry", () => {
    held.add = { problem: "loadFailed", canAdd: false };
    render(<ContentAddScreen />);
    expect(screen.getByTestId("content-add-failed")).toBeTruthy();
    fireEvent.click(screen.getByTestId("content-add-retry"));
    expect(held.retry).toHaveBeenCalled();
  });

  it("leaves the sheet when the kind of the route is unknown", () => {
    held.params = { kind: "ingredients", id: "e1" };
    render(<ContentAddScreen />);
    expect(held.router.back).toHaveBeenCalled();
    expect(screen.queryByTestId("content-add-sheet")).toBeNull();
  });
});
