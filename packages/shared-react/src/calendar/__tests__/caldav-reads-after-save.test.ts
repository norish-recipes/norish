import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useCaldavMutations } from "../use-caldav-mutations";
import { useCaldavConnectionQuery, useCaldavPasswordQuery } from "../use-caldav-query";
import { createMockCaldavConfig } from "./test-utils";

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

describe("CalDAV reads after a save", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;
  let stored: string;
  let check: PromiseWithResolvers<unknown>;

  beforeEach(() => {
    resetTRPCFake();
    queryClient = createTestQueryClient();
    stored = "old";
    check = Promise.withResolvers();
    serveTRPC(async (path) => {
      if (path === "caldav.getPassword") return stored;
      if (path === "caldav.checkConnection") return check.promise;
      if (path === "caldav.saveConfig") {
        stored = "new";

        return createMockCaldavConfig();
      }

      return null;
    });
  });

  const render = () =>
    renderHook(
      () => ({
        password: useCaldavPasswordQuery(),
        connection: useCaldavConnectionQuery(),
        mutations: useCaldavMutations(),
      }),
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
