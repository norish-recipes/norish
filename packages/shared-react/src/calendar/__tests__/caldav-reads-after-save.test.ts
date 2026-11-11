import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { trackedEvent } from "../../../__tests__/realtime/tracked-event";
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
function emitConfigSaved(version: number) {
  const { onData } = useSubscriptionMock.mock.calls.at(-1)?.[0] as {
    onData: (data: unknown) => void;
  };

  act(() =>
    onData(
      trackedEvent({ type: "configSaved", data: { config: createMockCaldavConfig({ version }) } })
    )
  );
}

/** Lets every request a render or a write starts go out. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

describe("CalDAV reads after a save", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let stored: string;
  let check: PromiseWithResolvers<unknown>;
  let requests: string[];
  const sent = (path: string) => requests.filter((request) => request === path).length;

  beforeEach(() => {
    resetTRPCFake();
    useSubscriptionMock.mockReset();
    queryClient = createTestQueryClient();
    stored = "old";
    check = Promise.withResolvers();
    requests = [];
    serveTRPC(async (path) => {
      requests.push(path);
      if (path === "caldav.getConfig") return createMockCaldavConfig();
      if (path === "caldav.getPassword") return stored;
      if (path === "caldav.checkConnection") return check.promise;
      if (path === "caldav.saveConfig") {
        stored = "new";

        return createMockCaldavConfig({ version: 2 });
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
    emitConfigSaved(2);
    await settle();

    expect(sent("caldav.getPassword")).toBe(1);
    await expect(result.current.password.read()).resolves.toBe("elsewhere");
  });

  const answerCheck = async (success: boolean) => {
    const answered = check;

    check = Promise.withResolvers();
    await act(async () => answered.resolve({ success, message: "" }));
  };

  it("checks the connection again after a save, showing the check until it answers", async () => {
    const result = render();

    await answerCheck(false);
    await waitFor(() => expect(result.current.connection.isChecking).toBe(false));

    await act(async () => {
      await result.current.mutations.saveConfig(SAVE);
    });
    await waitFor(() => expect(result.current.connection.isChecking).toBe(true));

    await answerCheck(true);
    await waitFor(() => expect(result.current.connection.isConnected).toBe(true));
    expect(result.current.connection.isChecking).toBe(false);
  });

  it("checks the connection again after a save on another device, once, writing nothing", async () => {
    const result = render();

    await answerCheck(true);
    await waitFor(() => expect(result.current.connection.isConnected).toBe(true));

    emitConfigSaved(2);
    await waitFor(() => expect(result.current.connection.isChecking).toBe(true));
    await answerCheck(false);
    await settle();

    expect(result.current.connection).toEqual({ isChecking: false, isConnected: false });
    expect(sent("caldav.checkConnection")).toBe(2);
    expect(sent("caldav.saveConfig") + sent("caldav.deleteConfig")).toBe(0);
  });

  it("checks the connection again after a delete, showing the check", async () => {
    const result = render();

    await answerCheck(true);
    await waitFor(() => expect(result.current.connection.isConnected).toBe(true));

    await act(async () => {
      await result.current.mutations.deleteConfig();
    });

    await waitFor(() => expect(result.current.connection.isChecking).toBe(true));
  });

  it("keeps the last answer on screen through a background recheck", async () => {
    vi.useFakeTimers();

    try {
      const result = render();

      await act(() => vi.advanceTimersByTimeAsync(0));
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
