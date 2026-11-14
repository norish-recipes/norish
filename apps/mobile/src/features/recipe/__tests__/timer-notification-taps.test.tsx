// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
let launch: unknown = null;
let listener: ((response: unknown) => void) | null = null;

vi.mock("expo-router", () => ({ useRouter: () => ({ push }) }));
vi.mock("expo-haptics", () => ({}));
vi.mock("react-intl", () => ({ useIntl: () => ({ formatMessage: () => "" }) }));
vi.mock("@norish/shared-react/config", () => ({ useTimersEnabledQuery: () => ({}) }));
vi.mock("expo-notifications", () => ({
  DEFAULT_ACTION_IDENTIFIER: "default",
  setNotificationHandler: vi.fn(),
  getLastNotificationResponse: () => launch,
  addNotificationResponseReceivedListener: (next: (response: unknown) => void) => {
    listener = next;

    return { remove: () => (listener = null) };
  },
}));

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
});
