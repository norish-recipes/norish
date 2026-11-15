// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  granted: false,
  appState: new Set<(state: string) => void>(),
  subscriptions: 0,
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
      native.subscriptions += 1;

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
const activity = vi.hoisted(() => vi.fn(async (_plan: { kind: string }) => {}));
vi.mock("@/lib/timer-activity", () => ({ syncTimerActivity: activity }));
vi.mock("expo-linking", () => ({
  createURL: (path: string, { queryParams }: { queryParams: { step: string } }) =>
    `norish://${path}?step=${queryParams.step}`,
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

  it("starts the Live Activity with the first timer and ends it after a sync in flight at sign-out", async () => {
    act(() => useTimerStore.getState().clearAll());
    native.permission = null;
    renderHook(() => useRecipeTimers());
    await new Promise((resolve) => setTimeout(resolve, 10));
    activity.mockClear();

    act(() => {
      useTimerStore
        .getState()
        .addTimer({ id: "la", recipeId: "r", label: "Step 1", durationMs: 60_000, stepIndex: 2 });
      useTimerStore.getState().startTimer("la");
    });
    await waitFor(() =>
      expect(activity).toHaveBeenLastCalledWith(
        expect.objectContaining({
          kind: "show",
          props: expect.objectContaining({ url: "norish:///recipe/r/cook?step=2" }),
        })
      )
    );

    let answer = () => {};

    native.permission = new Promise((resolve) => (answer = resolve));
    act(() => useTimerStore.getState().pauseTimer("la"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    const ended = endRecipeTimers();

    answer();
    await ended;

    // The pause's sync ran before the end, so the end is the last thing the activity saw.
    expect(activity.mock.calls.map(([plan]) => plan.kind)).toEqual(
      expect.arrayContaining(["show", "end"])
    );
    expect(activity).toHaveBeenLastCalledWith({ kind: "end" });
  });

  it("subscribes to the app's foreground once, however often it renders", () => {
    native.subscriptions = 0;
    const { rerender } = renderHook(() => useRecipeTimers());

    act(() => {
      useTimerStore
        .getState()
        .addTimer({ id: "again", recipeId: "r", label: "Step 3", durationMs: 60_000 });
    });
    rerender();

    expect(native.subscriptions).toBe(1);
  });
});
