// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  granted: false,
  appState: new Set<(state: string) => void>(),
  schedule: vi.fn(async () => ""),
}));

vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (_type: "change", listener: (state: string) => void) => {
      native.appState.add(listener);

      return { remove: () => native.appState.delete(listener) };
    },
  },
}));
vi.mock("expo-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("expo-haptics", () => ({}));
vi.mock("react-intl", () => ({ useIntl: () => ({ formatMessage: () => "Timer complete!" }) }));
vi.mock("@norish/shared-react/config", () => ({
  useTimersEnabledQuery: () => ({ timersEnabled: true }),
}));
vi.mock("expo-notifications", () => ({
  SchedulableTriggerInputTypes: { DATE: "date" },
  setNotificationHandler: vi.fn(),
  getLastNotificationResponse: () => null,
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  getAllScheduledNotificationsAsync: async () => [],
  cancelScheduledNotificationAsync: async () => {},
  getPermissionsAsync: async () => ({ granted: native.granted }),
  scheduleNotificationAsync: native.schedule,
}));

const { useRecipeTimers } = await import("../hooks/use-recipe-timers");
const { useTimerStore } = await import("@norish/shared-react/recipes/timers");

describe("useRecipeTimers' notifications", () => {
  it("schedules a running timer's notification when the app returns after a grant in Settings", async () => {
    renderHook(() => useRecipeTimers());
    act(() => {
      useTimerStore
        .getState()
        .addTimer({ id: "t", recipeId: "r", label: "Step 1", durationMs: 60_000 });
      useTimerStore.getState().startTimer("t");
    });
    // Refused: the start schedules nothing.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(native.schedule).not.toHaveBeenCalled();

    native.granted = true;
    act(() => native.appState.forEach((listener) => listener("active")));

    await waitFor(() => expect(native.schedule).toHaveBeenCalledTimes(1));
  });
});
