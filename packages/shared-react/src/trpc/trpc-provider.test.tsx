import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
