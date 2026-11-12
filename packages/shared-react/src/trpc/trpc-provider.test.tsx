import type { Observer } from "@trpc/server/observable";
import { renderHook } from "@testing-library/react";
import { observable } from "@trpc/server/observable";
import { describe, expect, it, vi } from "vitest";

import {
  createTRPCProviderBundle,
  useConnectionStatus,
  useTRPC,
  useTRPCClient,
} from "@norish/shared-react/trpc";

const logger = { info: () => undefined, warn: () => undefined, debug: () => undefined };

describe("the tRPC context", () => {
  it("is the one an app's provider bundle provides", () => {
    const { TRPCProviderWrapper } = createTRPCProviderBundle({
      logger,
      getBaseUrl: () => "http://localhost",
      getWsUrl: () => "ws://localhost",
    });

    const { result } = renderHook(
      () => ({ trpc: useTRPC(), client: useTRPCClient(), connection: useConnectionStatus() }),
      { wrapper: TRPCProviderWrapper }
    );

    expect(result.current.trpc.user.get.queryKey()).toEqual([["user", "get"], { type: "query" }]);
    expect(typeof result.current.client.user.get.query).toBe("function");
    expect(result.current.connection).toEqual({ status: "idle", isConnected: false });
  });

  it("is missing outside that provider", () => {
    expect(() => renderHook(() => useTRPC())).toThrow();
    expect(() => renderHook(() => useTRPCClient())).toThrow();
  });
});

describe("a provider's unauthorized callbacks", () => {
  it("report only while that provider is mounted: a retired client cannot expire the next session", async () => {
    const pending: Observer<never, unknown>[] = [];
    const onUnauthorized = vi.fn();
    const { TRPCProviderWrapper } = createTRPCProviderBundle({
      logger,
      getBaseUrl: () => "http://localhost",
      getWsUrl: () => "ws://localhost",
      enableLoggerLink: false,
      onUnauthorized,
      // A server that answers only when the test says so.
      extraLinks: [() => () => observable((observer) => void pending.push(observer))],
    });
    const { result, unmount } = renderHook(() => useTRPCClient(), { wrapper: TRPCProviderWrapper });
    const live = result.current.user.get.query().catch(() => null);
    const retired = result.current.user.get.query().catch(() => null);
    const unauthorized = { data: { code: "UNAUTHORIZED", httpStatus: 401 } };

    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[0]?.error(unauthorized);
    await live;
    expect(onUnauthorized).toHaveBeenCalledOnce();

    unmount();
    pending[1]?.error(unauthorized);
    await retired;
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
