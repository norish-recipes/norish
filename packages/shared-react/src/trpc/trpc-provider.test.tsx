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

// The WebSocket client's close handler, so a test can close it with 4401.
const wsCloses = vi.hoisted(() => [] as ((cause: unknown) => void)[]);

vi.mock("@trpc/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@trpc/client")>();

  return {
    ...actual,
    createWSClient: (options: { onClose: (cause: unknown) => void }) => {
      wsCloses.push(options.onClose);

      return { close: async () => undefined };
    },
  };
});

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
  const unauthorized = { data: { code: "UNAUTHORIZED", httpStatus: 401 } };

  function bundle() {
    const pending: Observer<never, unknown>[] = [];
    const onUnauthorized = vi.fn();
    const onWebSocketUnauthorized = vi.fn();
    const { TRPCProviderWrapper } = createTRPCProviderBundle({
      logger,
      getBaseUrl: () => "http://localhost",
      getWsUrl: () => "ws://localhost",
      enableLoggerLink: false,
      onUnauthorized,
      onWebSocketUnauthorized,
      // A server that answers only when the test says so.
      extraLinks: [() => () => observable((observer) => void pending.push(observer))],
    });

    return { pending, onUnauthorized, onWebSocketUnauthorized, TRPCProviderWrapper };
  }

  it("report only while that provider is mounted: a retired client cannot expire the next session", async () => {
    const { pending, onUnauthorized, TRPCProviderWrapper } = bundle();
    const { result, unmount } = renderHook(() => useTRPCClient(), { wrapper: TRPCProviderWrapper });
    const live = result.current.user.get.query().catch(() => null);
    const retired = result.current.user.get.query().catch(() => null);

    await vi.waitFor(() => expect(pending).toHaveLength(2));
    pending[0]?.error(unauthorized);
    await live;
    expect(onUnauthorized).toHaveBeenCalledOnce();

    unmount();
    pending[1]?.error(unauthorized);
    await retired;
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("report a 4401 close only while that provider is mounted", () => {
    const { onWebSocketUnauthorized, TRPCProviderWrapper } = bundle();
    const { unmount } = renderHook(() => useTRPCClient(), { wrapper: TRPCProviderWrapper });
    const close = wsCloses.at(-1);

    unmount();
    close?.({ code: 4401 });
    expect(onWebSocketUnauthorized).not.toHaveBeenCalled();

    const { unmount: unmountLive } = renderHook(() => useTRPCClient(), {
      wrapper: TRPCProviderWrapper,
    });

    wsCloses.at(-1)?.({ code: 4401 });
    expect(onWebSocketUnauthorized).toHaveBeenCalledOnce();
    unmountLive();
  });

  it("still report after StrictMode's unmount and remount", async () => {
    const { pending, onUnauthorized, TRPCProviderWrapper } = bundle();
    const { result } = renderHook(() => useTRPCClient(), {
      wrapper: TRPCProviderWrapper,
      reactStrictMode: true,
    });
    const query = result.current.user.get.query().catch(() => null);

    await vi.waitFor(() => expect(pending).toHaveLength(1));
    pending[0]?.error(unauthorized);
    await query;
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
