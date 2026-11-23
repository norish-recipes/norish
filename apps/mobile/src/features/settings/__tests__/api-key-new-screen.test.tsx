// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  settle: (_key: string | null) => {},
  forget: vi.fn(),
  back: vi.fn(),
  setOptions: vi.fn(),
}));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    Text: ({ children, testID }: { children?: ReactNode; testID?: string }) =>
      createElement("span", { "data-testid": testID }, children),
    View: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
  };
});
vi.mock("@/components/sheet", async () => {
  const { createElement } = await import("react");
  const { ModalHeader } = await import("../../../../__tests__/mocks/modal-header");

  return {
    Sheet: ({ children, ...header }: { children: ReactNode }) =>
      createElement("div", null, createElement(ModalHeader, header), children),
    SheetBody: ({ children }: { children: ReactNode }) => children,
  };
});
vi.mock("../components/offline-capsule", () => ({ OfflineCapsule: () => null }));
vi.mock("@/components/hint-button", () => ({ LabelWithHint: () => null }));
vi.mock("@/components/pill-button", () => ({ PillButton: () => null }));
vi.mock("@/components/sheet-input", () => ({ SheetInput: () => null }));
vi.mock("@/hooks/use-copy-to-clipboard", () => ({ useCopyToClipboard: () => vi.fn() }));
vi.mock("@/lib/offline/offline-now", () => ({ isOfflineNow: () => false }));
vi.mock("heroui-native", () => ({
  TextField: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("expo-router", () => ({
  useRouter: () => ({ back: state.back }),
  useNavigation: () => ({ setOptions: state.setOptions }),
}));
vi.mock("@norish/shared-react/offline/react", () => ({
  useConnectivity: () => ({ isOffline: false }),
}));
vi.mock("@norish/shared-react/reader", () => ({
  useApiKeyMutations: () => ({
    createApiKey: () => new Promise((resolve) => (state.settle = resolve)),
    forgetCreatedKey: state.forget,
  }),
}));

const { ApiKeyNewScreen } = await import("../screens/api-key-new-screen");

const close = () => screen.getByTestId("header-close") as HTMLButtonElement;
const swipeable = () => state.setOptions.mock.lastCall?.[0].gestureEnabled;

describe("the create key sheet", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cannot be dismissed from Create until the key is saved, then forgets the key", async () => {
    render(<ApiKeyNewScreen />);
    expect(swipeable()).toBe(true);

    act(() => fireEvent.click(screen.getByTestId("header-confirm")));
    expect(swipeable()).toBe(false);
    expect(close().disabled).toBe(true);

    await act(async () => state.settle("sk-secret"));
    expect(screen.getByTestId("api-key-value").textContent).toBe("sk-secret");
    expect(swipeable()).toBe(false);
    expect(close().disabled).toBe(true);

    fireEvent.click(screen.getByTestId("header-confirm"));
    expect(state.forget).toHaveBeenCalledOnce();
    expect(state.back).toHaveBeenCalledOnce();
  });

  it("can be dismissed again when the create failed", async () => {
    render(<ApiKeyNewScreen />);

    act(() => fireEvent.click(screen.getByTestId("header-confirm")));
    await act(async () => state.settle(null));

    expect(swipeable()).toBe(true);
    expect(close().disabled).toBe(false);
  });
});
