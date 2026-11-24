// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  answers: [] as ((went: boolean) => void)[],
  updateName: vi.fn(),
  uploadAvatar: vi.fn(),
}));
const pending = () => new Promise<boolean>((resolve) => state.answers.push(resolve));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    Pressable: ({
      children,
      testID,
      onPress,
    }: {
      children?: ReactNode;
      testID?: string;
      onPress?: () => void;
    }) => createElement("button", { "data-testid": testID, onClick: onPress }, children),
    Text: ({ children }: { children?: ReactNode }) => createElement("span", null, children),
    View: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
  };
});
vi.mock("@/components/user-avatar", () => ({ UserAvatar: () => null }));
vi.mock("@/hooks/use-photo-source-sheet", () => ({
  usePhotoSourceSheet: () => (_options: unknown, pick: (assets: { uri: string }[]) => void) =>
    pick([{ uri: "file:///photo.jpg" }]),
}));
vi.mock("@/lib/i18n/use-text", () => ({ useText: () => (id: string) => id }));
vi.mock("@/lib/network/server-url", () => ({ useServerImage: () => (uri: string) => ({ uri }) }));
vi.mock("@/lib/offline/offline-now", () => ({ isOfflineNow: () => false }));
vi.mock("expo-file-system", () => ({
  File: class {
    constructor(readonly uri: string) {}
  },
}));
vi.mock("@norish/shared-react/offline/react", () => ({
  useConnectivity: () => ({ isOffline: false }),
}));
vi.mock("@norish/shared-react/reader", () => ({
  useProfileQuery: () => ({ user: { name: "Ann", email: "ann@example.com", image: null } }),
  useProfileMutations: () => ({
    updateName: state.updateName,
    uploadAvatar: state.uploadAvatar,
    deleteAvatar: vi.fn(),
  }),
}));
vi.mock("../components/settings-form", async () => {
  const { createElement } = await import("react");

  return {
    SettingsField: ({
      testID,
      value,
      onChangeText,
    }: {
      testID: string;
      value: string;
      onChangeText: (value: string) => void;
    }) =>
      createElement("input", {
        "data-testid": testID,
        value,
        onChange: (event: { target: { value: string } }) => onChangeText(event.target.value),
      }),
    SubmitButton: ({ testID, onPress }: { testID: string; onPress: () => void }) =>
      createElement("button", { "data-testid": testID, onClick: onPress }),
  };
});
vi.mock("../components/settings-group", () => ({
  SettingsGroup: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock("../components/settings-row", () => ({ SettingsRow: () => null }));

const { ProfileForm } = await import("../components/profile-form");

const field = () => screen.getByTestId("settings-profile-name") as HTMLInputElement;

describe("the profile form", () => {
  it("sends a name saved on a reopened Profile while the photo upload is in flight", async () => {
    state.updateName.mockImplementation(pending);
    state.uploadAvatar.mockImplementation(pending);
    const first = render(<ProfileForm />);

    fireEvent.click(screen.getByTestId("settings-profile-avatar"));
    await act(async () => fireEvent.click(screen.getByTestId("settings-profile-save")));
    expect(state.uploadAvatar).toHaveBeenCalledOnce();
    first.unmount();

    render(<ProfileForm />);
    fireEvent.change(field(), { target: { value: "Bea" } });
    await act(async () => fireEvent.click(screen.getByTestId("settings-profile-save")));
    expect(state.updateName).toHaveBeenCalledExactlyOnceWith("Bea");

    // The upload's answer is not the name's: the name draft stays until its own save answers.
    await act(async () => state.answers[0]?.(true));
    expect(field().value).toBe("Bea");
    await act(async () => state.answers[1]?.(true));
  });
});
