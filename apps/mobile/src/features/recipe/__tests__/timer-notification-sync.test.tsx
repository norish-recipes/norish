// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  granted: false,
  appState: new Set<(state: string) => void>(),
  pending: new Set<string>(),
  permission: null as Promise<void> | null,
  schedule: vi.fn(async ({ identifier }: { identifier: string }) => {
    native.pending.add(identifier);

    return identifier;
  }),
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
  clearLastNotificationResponse: () => {},
  getAllScheduledNotificationsAsync: async () =>
    [...native.pending].map((identifier) => ({ identifier })),
  getPresentedNotificationsAsync: async () => [],
  cancelScheduledNotificationAsync: async (identifier: string) =>
    void native.pending.delete(identifier),
  dismissNotificationAsync: async () => {},
  getPermissionsAsync: async () => {
    await native.permission;

    return { granted: native.granted };
  },
  scheduleNotificationAsync: native.schedule,
}));

const { useRecipeTimers } = await import("../hooks/use-recipe-timers");
const { useTimerStore } = await import("@norish/shared-react/recipes/timers");
const { endRecipeTimers } = await import("@/lib/timer-notifications");

describe("useRecipeTimers' notifications", () => {
  afterEach(cleanup);

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

  it("leaves nothing scheduled when the session ends during a sync", async () => {
    act(() => useTimerStore.getState().clearAll());
    native.pending.clear();
    native.granted = true;
    const { unmount } = renderHook(() => useRecipeTimers());
    let answer = () => {};

    await new Promise((resolve) => setTimeout(resolve, 10));
    native.permission = new Promise((resolve) => (answer = resolve));

    act(() => {
      useTimerStore
        .getState()
        .addTimer({ id: "late", recipeId: "r", label: "Step 2", durationMs: 60_000 });
      useTimerStore.getState().startTimer("late");
    });
    // The sync has planned the schedule and waits on the permission answer.
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Ending a session unmounts the signed-in effects, so no later sync cleans up.
    unmount();
    const ended = endRecipeTimers();

    await new Promise((resolve) => setTimeout(resolve, 10));
    answer();
    await ended;
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(native.pending).toEqual(new Set());
  });
});
