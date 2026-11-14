// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let launch: unknown = null;
let listener: ((response: unknown) => void) | null = null;
const scheduled = vi.hoisted(() => new Set<string>());
const presented = vi.hoisted(() => new Set<string>());

vi.mock("react-native", () => ({ AppState: { addEventListener: () => ({ remove: () => {} }) } }));
vi.mock("expo-router", () => ({ useRouter: () => ({ push }) }));
vi.mock("expo-haptics", () => ({}));
vi.mock("react-intl", () => ({ useIntl: () => ({ formatMessage: () => "" }) }));
vi.mock("@norish/shared-react/config", () => ({ useTimersEnabledQuery: () => ({}) }));
vi.mock("expo-notifications", () => ({
  DEFAULT_ACTION_IDENTIFIER: "default",
  setNotificationHandler: vi.fn(),
  getLastNotificationResponse: () => launch,
  clearLastNotificationResponse: () => (launch = null),
  getAllScheduledNotificationsAsync: async () =>
    [...scheduled].map((identifier) => ({ identifier })),
  cancelScheduledNotificationAsync: async (identifier: string) => void scheduled.delete(identifier),
  getPresentedNotificationsAsync: async () =>
    [...presented].map((identifier) => ({ request: { identifier } })),
  dismissNotificationAsync: async (identifier: string) => void presented.delete(identifier),
  addNotificationResponseReceivedListener: (next: (response: unknown) => void) => {
    listener = next;

    return { remove: () => (listener = null) };
  },
}));
vi.mock("@/lib/trpc/trpc-provider", () => ({ closeMobileTrpcConnections: vi.fn() }));
vi.mock("@/lib/auth/auth-client", () => ({ resetAuthClientStorage: vi.fn() }));

const response = (identifier: string, data: Record<string, unknown>, action = "default") => ({
  actionIdentifier: action,
  notification: { request: { identifier, content: { data } } },
});

const cook = (id: string, step: string) => ({
  pathname: "/recipe/[id]/cook",
  params: { id, step },
});

describe("useTimerNotificationTaps", () => {
  beforeEach(() => {
    push.mockClear();
    launch = null;
    listener = null;
  });

  it("opens cook mode on the timer's step from a cold start, once though the launch tap is replayed", async () => {
    const { useTimerNotificationTaps } = await import("../hooks/use-recipe-timers");

    launch = response("timer:r-s2-0@1", { recipeId: "r", step: 2 });
    renderHook(() => useTimerNotificationTaps());
    listener?.(launch);

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(cook("r", "2"));
  });

  it("opens on a tap while running and ignores other notifications and actions", async () => {
    const { useTimerNotificationTaps } = await import("../hooks/use-recipe-timers");

    renderHook(() => useTimerNotificationTaps());
    listener?.(response("other", { kind: "something-else" }));
    listener?.(response("timer:r-s0-0@2", { recipeId: "r", step: 0 }, "dismiss"));
    listener?.(response("timer:r-s0-0@3", { recipeId: "r", step: 0 }));

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(cook("r", "0"));
  });

  it("forgets the device's timers at Sign-out, so a tap from before it is not replayed at the next sign-in", async () => {
    const { useTimerNotificationTaps } = await import("../hooks/use-recipe-timers");
    const { useTimerStore } = await import("@norish/shared-react/recipes/timers");
    const { endSession } = await import("@/lib/auth/end-session");

    useTimerStore
      .getState()
      .addTimer({ id: "r-s0-0", recipeId: "r", label: "Step 1", durationMs: 60_000 });
    scheduled.add("timer:r-s0-0@5").add("other");
    presented.add("timer:r-s1-0@4").add("other");
    launch = response("timer:r-s1-0@4", { recipeId: "r", step: 1 });

    await endSession({ signOut: async () => {} }, "everywhere");
    renderHook(() => useTimerNotificationTaps());

    expect(push).not.toHaveBeenCalled();
    expect(useTimerStore.getState().timers).toEqual([]);
    expect([...scheduled]).toEqual(["other"]);
    expect([...presented]).toEqual(["other"]);
  });
});
