import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const socket = vi.hoisted(() => ({ close: vi.fn(() => Promise.resolve()) }));

vi.mock("../../src/trpc/trpc-links", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/trpc/trpc-links")>()),
  // The links open their WebSocket client as they are built.
  createTRPCClientLinks: (options: {
    onWebSocketClientCreate?: (client: typeof socket) => void;
  }) => {
    options.onWebSocketClientCreate?.(socket);

    return [];
  },
}));

const { createTRPCProviderBundle } = await import("../../src/trpc/trpc-provider");

describe("TRPCProviderWrapper", () => {
  it("closes the links' WebSocket client when it unmounts, and only then", () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn() };
    const { TRPCProviderWrapper } = createTRPCProviderBundle({ logger });
    const root = createRoot(document.createElement("div"));

    act(() => root.render(<TRPCProviderWrapper>{null}</TRPCProviderWrapper>));
    expect(socket.close).not.toHaveBeenCalled();

    act(() => root.unmount());
    expect(socket.close).toHaveBeenCalledOnce();
  });
});
