import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { emitTrackedEvent } from "../../../__tests__/realtime/tracked-event";
import { resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useCaldavMutations } from "../use-caldav-mutations";
import { useCaldavConnectionQuery, useCaldavPasswordQuery } from "../use-caldav-query";
import { useCaldavSubscription } from "../use-caldav-subscription";
import { createMockCaldavConfig } from "./test-utils";

const useSubscriptionMock = vi.hoisted(() => vi.fn());

vi.mock("@trpc/tanstack-react-query", async () => ({
  ...(await vi.importActual<typeof import("@trpc/tanstack-react-query")>(
    "@trpc/tanstack-react-query"
  )),
  useSubscription: useSubscriptionMock,
}));
vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const SAVE = {
  serverUrl: "https://cal.example.com",
  username: "mike",
  password: "new",
  enabled: true,
  breakfastTime: "07:00-08:00",
  lunchTime: "12:00-13:00",
  dinnerTime: "18:00-19:00",
  snackTime: "15:00-16:00",
};

/** A config saved on another device, as the subscription delivers it. */
const configSaved = (version: number) => ({
  type: "configSaved",
  data: { config: createMockCaldavConfig({ version }) },
});

/** Lets every request a render or a write starts go out. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

describe("CalDAV reads after a save", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let stored: string;
  let config: ReturnType<typeof createMockCaldavConfig> | null;
  let checks: PromiseWithResolvers<unknown>[];
  let requests: string[];
  let passwordGate: Promise<void>;
  const sent = (path: string) => requests.filter((request) => request === path).length;

  beforeEach(() => {
    resetTRPCFake();
    useSubscriptionMock.mockReset();
    queryClient = createTestQueryClient();
    stored = "old";
    config = createMockCaldavConfig();
    checks = [];
    requests = [];
    passwordGate = Promise.resolve();
    serveTRPC(async (path) => {
      requests.push(path);
      if (path === "caldav.getConfig") return config;
      if (path === "caldav.getPassword") {
        const answer = stored;

        await passwordGate;

        return answer;
      }
      if (path === "caldav.checkConnection") {
        const check = Promise.withResolvers();

        checks.push(check);

        return check.promise;
      }
      if (path === "caldav.saveConfig") {
        stored = "new";
        config = createMockCaldavConfig({ version: 2 });

        return config;
      }
      if (path === "caldav.deleteConfig") {
        config = null;

        return { success: true };
      }

      return null;
    });
  });

  const render = () =>
    renderHook(
      () => {
        useCaldavSubscription();

        return {
          password: useCaldavPasswordQuery(),
          connection: useCaldavConnectionQuery(),
          mutations: useCaldavMutations(),
        };
      },
      { wrapper: createTestWrapper(queryClient, fakePlatformAdapter()) }
    ).result;

  it("reads the saved password, never the one held from before the save", async () => {
    const result = render();

    await waitFor(() => expect(result.current.password.password).toBe("old"));
    await act(async () => {
      await result.current.mutations.saveConfig(SAVE);
    });

    await expect(result.current.password.read()).resolves.toBe("new");
  });

  it("asks for the password after a save only when read, with the form still mounted", async () => {
    const result = render();

    await waitFor(() => expect(result.current.password.password).toBe("old"));
    await act(async () => {
      await result.current.mutations.saveConfig(SAVE);
    });
    await settle();

    expect(sent("caldav.getPassword")).toBe(1);
    await expect(result.current.password.read()).resolves.toBe("new");
    expect(sent("caldav.getPassword")).toBe(2);
  });

  it("reads the password a save on another device stored", async () => {
    const result = render();

    await waitFor(() => expect(result.current.password.password).toBe("old"));
    stored = "elsewhere";
    emitTrackedEvent(useSubscriptionMock, configSaved(2));
    await settle();

    expect(sent("caldav.getPassword")).toBe(1);
    await expect(result.current.password.read()).resolves.toBe("elsewhere");
  });

  it("never keeps a password read begun before a save as the fresh one", async () => {
    const result = render();

    await waitFor(() => expect(result.current.password.password).toBe("old"));
    stored = "second";
    emitTrackedEvent(useSubscriptionMock, configSaved(2));
    const gate = Promise.withResolvers<void>();

    passwordGate = gate.promise;
    const early = result.current.password.read();

    await vi.waitFor(() => expect(sent("caldav.getPassword")).toBe(2));
    stored = "third";
    emitTrackedEvent(useSubscriptionMock, configSaved(3));
    gate.resolve();
    await act(() => early);

    await expect(result.current.password.read()).resolves.toBe("third");
    expect(sent("caldav.getPassword")).toBe(3);
  });

  /** Answers the latest connection check once it was sent. */
  const answerCheck = async (success: boolean, count = 1) => {
    await vi.waitFor(() => expect(checks).toHaveLength(count));
    await act(async () => checks.at(-1)?.resolve({ success, message: "" }));
  };

  it("checks the connection again after a save, showing the check until it answers", async () => {
    const result = render();

    await answerCheck(false);
    await waitFor(() => expect(result.current.connection.isChecking).toBe(false));

    await act(async () => {
      await result.current.mutations.saveConfig(SAVE);
    });
    await waitFor(() => expect(result.current.connection.isChecking).toBe(true));

    await answerCheck(true, 2);
    await waitFor(() => expect(result.current.connection.isConnected).toBe(true));
    expect(result.current.connection.isChecking).toBe(false);
  });

  it("checks the connection again after a save on another device, once, writing nothing", async () => {
    const result = render();

    await answerCheck(true);
    await waitFor(() => expect(result.current.connection.isConnected).toBe(true));

    emitTrackedEvent(useSubscriptionMock, configSaved(2));
    await waitFor(() => expect(result.current.connection.isChecking).toBe(true));
    await answerCheck(false, 2);
    await settle();

    expect(result.current.connection).toEqual({ isChecking: false, isConnected: false });
    expect(sent("caldav.checkConnection")).toBe(2);
    expect(sent("caldav.saveConfig") + sent("caldav.deleteConfig")).toBe(0);
  });

  it("checks no connection after a delete and leaves no poller", async () => {
    vi.useFakeTimers();

    try {
      const result = render();

      await answerCheck(true);
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(result.current.connection.isConnected).toBe(true);

      await act(async () => {
        await result.current.mutations.deleteConfig();
      });
      await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));

      expect(sent("caldav.checkConnection")).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("checks the connection only once a config exists", async () => {
    config = null;
    render();
    await settle();

    expect(sent("caldav.getConfig")).toBe(1);
    expect(sent("caldav.checkConnection")).toBe(0);
  });

  it("keeps the last answer on screen through a background recheck", async () => {
    vi.useFakeTimers();

    try {
      const result = render();

      await answerCheck(true);
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(result.current.connection.isConnected).toBe(true);

      await act(() => vi.advanceTimersByTimeAsync(60_000));

      expect(result.current.connection).toEqual({ isChecking: false, isConnected: true });
    } finally {
      vi.useRealTimers();
    }
  });
});
