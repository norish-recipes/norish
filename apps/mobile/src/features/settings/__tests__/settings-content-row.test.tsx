// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "../../../../__tests__/mocks/content-setup";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("expo-router", () => ({ useRouter: () => router }));
vi.mock("expo-application", () => ({ nativeApplicationVersion: "1", nativeBuildVersion: "1" }));
vi.mock("@/hooks/use-change-server-address", () => ({ changeServerAddress: vi.fn() }));
vi.mock("@/hooks/use-confirmed-sign-out", () => ({ useConfirmedSignOut: () => vi.fn() }));
vi.mock("@/lib/i18n/mobile-i18n-context", () => ({
  useMobileLocaleSettings: () => ({ locale: "en", options: [] }),
}));
vi.mock("@/lib/network/host-of", () => ({ hostOf: (value: string) => value }));
vi.mock("@/lib/network/server-address", async () => {
  const { createContext } = await import("react");

  return { ServerAddressContext: createContext(null) };
});
vi.mock("@norish/shared-react/config", () => ({ useServerVersionQuery: () => null }));
vi.mock("@norish/shared-react/reader", () => ({
  useReader: () => ({ user: null }),
  useAllergiesQuery: () => ({ allergies: [] }),
  useHousehold: () => ({ household: { name: "Home" } }),
}));
vi.mock("../components/profile-card", () => ({ ProfileCard: () => null }));
vi.mock("../components/settings-page", () => ({
  SettingsPage: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../components/settings-group", () => ({
  SettingsGroup: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../components/settings-row", () => ({
  SettingsRow: ({ testID, onPress }: { testID: string; onPress?: () => void }) => (
    <button data-testid={testID} onClick={onPress} />
  ),
}));

const { SettingsScreen } = await import("../screens/settings-screen");

describe("Settings' Content row", () => {
  it("opens Content", () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByTestId("settings-root-content"));
    expect(router.push).toHaveBeenCalledWith("/settings/content");
  });
});
