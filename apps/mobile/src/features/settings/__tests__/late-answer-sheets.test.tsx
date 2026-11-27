// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  settle: (_answer: unknown) => {},
  back: vi.fn(),
  toast: vi.fn(),
  focused: true,
}));
const pending = () => new Promise((resolve) => (state.settle = resolve));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    Text: ({ children }: { children?: ReactNode }) => createElement("span", null, children),
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
vi.mock("@/components/switch", () => ({ Switch: () => null }));
vi.mock("@/lib/auth/use-auth-client", () => ({
  useAuthClient: () => ({ changePassword: pending }),
}));
vi.mock("@/lib/i18n/use-text", () => ({ useText: () => (id: string) => id }));
vi.mock("@/lib/offline/offline-now", () => ({ isOfflineNow: () => false }));
vi.mock("expo-router", () => ({
  useRouter: () => ({ back: state.back }),
  useNavigation: () => ({ setOptions: vi.fn(), isFocused: () => state.focused }),
}));
vi.mock("@norish/shared-react/offline/react", () => ({
  useConnectivity: () => ({ isOffline: false }),
}));
vi.mock("@norish/shared-react/platform", () => ({
  usePlatform: () => ({ toast: { show: state.toast } }),
}));
vi.mock("@norish/shared/lib/auth/password", () => ({ passwordChecks: () => ({ valid: true }) }));
vi.mock("@norish/shared-react/reader", () => ({
  siteAuthTokenForm: () => ({ valid: true, domainBare: false }),
  useSiteAuthTokenMutations: () => ({ createToken: pending }),
}));
vi.mock("../components/choice-row", () => ({ ChoiceRow: () => null }));
vi.mock("@/components/offline-capsule", () => ({ OfflineCapsule: () => null }));
vi.mock("../components/settings-form", () => ({ SettingsField: () => null }));
vi.mock("../components/settings-group", () => ({
  SettingsGroup: ({ children }: { children?: ReactNode }) => children,
}));

const { TokenNewScreen } = await import("../screens/token-new-screen");
const { PasswordScreen } = await import("../screens/password-screen");
const { listenForWriteNotices, SETTINGS_WRITE_TIMEOUT_MS } =
  await import("../utils/settings-write");

const LATE = ["common.lateAnswer.title", "success"];

const sheets = [
  { name: "add token", Screen: TokenNewScreen, success: true, failure: false },
  { name: "password change", Screen: PasswordScreen, success: { error: null }, failure: {} },
];

describe.each(sheets)(
  "the $name sheet answered after the release",
  ({ Screen, success, failure }) => {
    const told = vi.fn();
    let stopListening = () => {};

    beforeEach(async () => {
      vi.clearAllMocks();
      vi.useFakeTimers();
      state.focused = true;
      stopListening = listenForWriteNotices(told);
      render(<Screen />);
      act(() => fireEvent.click(screen.getByTestId("header-confirm")));
      await act(() => vi.advanceTimersByTimeAsync(SETTINGS_WRITE_TIMEOUT_MS));
      expect(told).toHaveBeenCalledExactlyOnceWith("common.errors.noAnswer");
    });
    afterEach(() => {
      stopListening();
      vi.useRealTimers();
    });

    it("closes, saying it went through, while it is still in front", async () => {
      await act(async () => state.settle(success));

      expect(state.back).toHaveBeenCalledOnce();
      expect(told).toHaveBeenLastCalledWith(...LATE);
    });

    it("changes nothing on screen once it is gone", async () => {
      state.focused = false;
      await act(async () => state.settle(success));

      expect(state.back).not.toHaveBeenCalled();
      expect(told).toHaveBeenCalledOnce();
    });

    it("shows nothing more for a late failure", async () => {
      await act(async () => state.settle(failure));

      expect(state.back).not.toHaveBeenCalled();
      expect(state.toast).not.toHaveBeenCalled();
      expect(told).toHaveBeenCalledOnce();
    });
  }
);
