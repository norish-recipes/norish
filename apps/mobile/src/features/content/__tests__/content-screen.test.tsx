// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "../../../../__tests__/mocks/content-setup";

const held = vi.hoisted(() => ({
  router: { push: vi.fn() },
  params: {} as Record<string, string>,
  offline: false,
  reset: vi.fn(),
  list: {} as { onOpen?: (id: string) => void },
}));

vi.mock("expo-router", () => ({
  useRouter: () => held.router,
  useLocalSearchParams: () => held.params,
}));
vi.mock("@/components/segmented", async () => {
  const { createElement } = await import("react");

  return {
    Segmented: ({
      segments,
      value,
      onChange,
    }: {
      segments: { value: string; testID: string }[];
      value: string;
      onChange: (value: string) => void;
    }) =>
      segments.map((segment) =>
        createElement("button", {
          key: segment.value,
          "data-testid": segment.testID,
          "aria-selected": segment.value === value,
          onClick: () => onChange(segment.value),
        })
      ),
  };
});
vi.mock("@/components/offline-capsule", () => ({ OfflineCapsule: () => null }));
vi.mock("../components/entry-list", () => ({
  EntryList: ({ list, onOpen }: { list: string; onOpen: (id: string) => void }) => {
    held.list.onOpen = onOpen;

    return <i data-testid={`entries-${list}`} />;
  },
}));
vi.mock("../components/ingredient-list", () => ({
  IngredientList: () => <i data-testid="ingredients" />,
}));
vi.mock("@norish/shared-react/offline/react", () => ({
  useConnectivity: () => ({ isOffline: held.offline }),
}));
vi.mock("@norish/shared-react/ingredients", () => ({
  useIngredientFiltersStore: () => held.reset,
}));

const { ContentScreen } = await import("../screens/content-screen");

describe("ContentScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.params = {};
    held.offline = false;
  });

  it("opens on Tags, announces the selected tab, and switches lists", () => {
    render(<ContentScreen />);
    expect(screen.getByTestId("entries-tags")).toBeTruthy();
    expect(screen.getByTestId("content-tab-tags").getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByTestId("content-tab-categories"));
    expect(screen.getByTestId("entries-categories")).toBeTruthy();
    fireEvent.click(screen.getByTestId("content-tab-ingredients"));
    expect(screen.getByTestId("ingredients")).toBeTruthy();
    expect(screen.getByTestId("content-tab-ingredients").getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  it("opens on the list a link names", () => {
    held.params = { list: "cuisines" };
    render(<ContentScreen />);
    expect(screen.getByTestId("entries-cuisines")).toBeTruthy();
  });

  it("follows the list the route names when it changes", () => {
    held.params = { list: "cuisines" };

    const { rerender } = render(<ContentScreen />);

    fireEvent.click(screen.getByTestId("content-tab-tags"));
    expect(screen.getByTestId("entries-tags")).toBeTruthy();
    held.params = { list: "ingredients" };
    rerender(<ContentScreen />);
    expect(screen.getByTestId("ingredients")).toBeTruthy();
    expect(screen.getByTestId("content-tab-ingredients").getAttribute("aria-selected")).toBe(
      "true"
    );
  });

  it("adds to the list shown: an entry sheet for a Tag, the food sheet for Ingredients", () => {
    render(<ContentScreen />);
    expect(screen.getByTestId("header-add").getAttribute("aria-label")).toBe(
      "settings.content.panel.addTitle.tag"
    );
    fireEvent.click(screen.getByTestId("header-add"));
    expect(held.router.push).toHaveBeenCalledWith({
      pathname: "/settings/content-add",
      params: { kind: "tag" },
    });
    fireEvent.click(screen.getByTestId("content-tab-ingredients"));
    fireEvent.click(screen.getByTestId("header-add"));
    expect(held.router.push).toHaveBeenLastCalledWith("/settings/ingredient-add");
  });

  it("opens an entry's sheet", () => {
    render(<ContentScreen />);
    held.list.onOpen?.("e1");
    expect(held.router.push).toHaveBeenCalledWith({
      pathname: "/settings/content-entry",
      params: { kind: "tag", id: "e1" },
    });
  });

  it("turns Add off Offline", () => {
    held.offline = true;
    render(<ContentScreen />);
    expect((screen.getByTestId("header-add") as HTMLButtonElement).disabled).toBe(true);
  });
});
