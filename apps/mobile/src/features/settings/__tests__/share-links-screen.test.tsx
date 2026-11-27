// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  invalidate: vi.fn(),
  readLink: vi.fn<(id: string) => Promise<string | null>>(),
}));

vi.mock("@/hooks/use-copy-to-clipboard", () => ({
  useCopyToClipboard: () => (link: Promise<string>) =>
    link.then(
      () => undefined,
      () => undefined
    ),
}));
vi.mock("@/lib/i18n/use-text", () => ({ useText: () => (id: string) => id }));
vi.mock("@/lib/network/server-url", () => ({ useServerUrl: () => (path: string) => path }));
vi.mock("@/lib/share-subtitle", () => ({ shareEnding: () => "" }));
vi.mock("react-intl", () => ({ useIntl: () => ({ formatDate: () => "" }) }));
vi.mock("@norish/shared-react/recipes", () => ({
  shareLinkActions: () => ["copy"],
  useMyRecipeSharesQuery: () => ({
    shares: [{ id: "s1", recipeName: "Soup", version: 1, status: "active" }],
    invalidate: state.invalidate,
  }),
  useRecipeShareMutations: () => ({}),
  useShareLink: () => state.readLink,
}));
vi.mock("../components/connection-list", () => ({
  ConnectionList: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../components/settings-group", () => ({
  SettingsGroup: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../components/settings-page", () => ({
  SettingsPage: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../components/settings-row", async () => {
  const { createElement } = await import("react");

  return {
    SettingsRow: ({ actions }: { actions: { label: string; onPress: () => void }[] }) =>
      actions.map((action) =>
        createElement("button", { key: action.label, onClick: action.onPress }, action.label)
      ),
  };
});
vi.mock("../hooks/use-confirmed-write", () => ({ useConfirmedWrite: () => () => () => {} }));

const { ShareLinksScreen } = await import("../screens/share-links-screen");

describe("Copy link", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["kept no link", () => Promise.resolve(null)],
    ["was deleted elsewhere", () => Promise.reject(new Error("NOT_FOUND"))],
  ])("rereads the list when the share %s", async (_case, answer) => {
    state.readLink.mockImplementation(answer);
    render(<ShareLinksScreen />);

    await act(async () => fireEvent.click(screen.getByText("recipes.sharePanel.copyLink")));

    expect(state.invalidate).toHaveBeenCalledOnce();
  });

  it("leaves the list alone when the link was copied", async () => {
    state.readLink.mockResolvedValue("/share/abc");
    render(<ShareLinksScreen />);

    await act(async () => fireEvent.click(screen.getByText("recipes.sharePanel.copyLink")));

    expect(state.invalidate).not.toHaveBeenCalled();
  });
});
