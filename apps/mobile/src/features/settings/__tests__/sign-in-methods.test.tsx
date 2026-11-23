// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  offered: [] as { id: string; name: string; icon: string; type: "oauth" | "credential" }[],
  read: {} as Record<string, unknown>,
}));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    View: ({ children, testID }: { children?: ReactNode; testID?: string }) =>
      createElement("div", { "data-testid": testID }, children),
  };
});
vi.mock("heroui-native", () => ({ Skeleton: () => null, useThemeColor: () => ["#000"] }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id, formatDate: () => "" }),
}));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/provider-icon", () => ({ ProviderIcon: () => null }));
vi.mock("@/lib/auth/use-auth-client", () => ({ useAuthClient: () => null }));
vi.mock("@norish/shared-react/platform", () => ({ usePlatform: () => ({ toast: {} }) }));
vi.mock("@norish/shared-react/config", () => ({
  useAuthProvidersQuery: () => ({ providers: state.offered }),
}));
vi.mock("@norish/shared-react/reader", () => ({
  useProfileQuery: () => ({ user: null }),
  useSignInMethodsQuery: () => ({
    signInMethods: [],
    answered: false,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...state.read,
  }),
}));
vi.mock("../components/failed-load", async () => {
  const { createElement } = await import("react");

  return {
    FailedLoad: ({ name }: { name: string }) =>
      createElement("div", { "data-testid": `${name}-failed` }),
  };
});
vi.mock("../components/settings-group", async () => {
  const { createElement } = await import("react");

  return {
    SettingsGroup: ({ children, testID }: { children?: ReactNode; testID?: string }) =>
      createElement("section", { "data-testid": testID }, children),
  };
});
vi.mock("../components/settings-row", async () => {
  const { createElement } = await import("react");

  return {
    SettingsRow: ({ testID }: { testID?: string }) =>
      createElement("div", { "data-testid": testID }),
  };
});

const { SignInMethods } = await import("../components/sign-in-methods");

const PASSWORD = { id: "credential", name: "Email", icon: "", type: "credential" as const };
const SSO = { id: "oidc", name: "SSO", icon: "", type: "oauth" as const };

describe("the sign-in methods", () => {
  beforeEach(() => {
    state.offered = [PASSWORD, SSO];
    state.read = {};
  });

  it("shows a failed read as failed, never as an empty list", () => {
    state.read = { error: new Error("down") };
    render(<SignInMethods />);

    expect(screen.getByTestId("sign-in-methods-failed")).toBeTruthy();
    expect(screen.queryByTestId("sign-in-methods")).toBeNull();
  });

  it("shows the skeleton while the first read is under way", () => {
    state.read = { isLoading: true };
    render(<SignInMethods />);

    expect(screen.getByTestId("sign-in-methods-loading")).toBeTruthy();
  });

  it("lists the methods once read", () => {
    state.read = {
      answered: true,
      signInMethods: [{ id: "a1", providerId: "credential", createdAt: new Date(0) }],
    };
    render(<SignInMethods />);

    expect(screen.getByTestId("sign-in-method-credential")).toBeTruthy();
  });

  it("draws nothing on a server that offers one method and no password, read or not", () => {
    state.offered = [SSO];
    state.read = { error: new Error("down") };
    const { container } = render(<SignInMethods />);

    expect(container.innerHTML).toBe("");
  });
});
