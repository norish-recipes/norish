/** Where recipes add to the list: built-in until the instance says Bring!. */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { resetTRPCFake, serveTRPC, trpcCalls } from "../trpc/testing";
import { useGroceryListProvider } from "./use-grocery-list-provider-query";

vi.mock("../trpc", async () => (await import("../trpc/testing")).mockTRPC());

afterEach(resetTRPCFake);

function read(supportsExternalShoppingList = true) {
  return renderHook(() => useGroceryListProvider(), {
    wrapper: createTestWrapper(createTestQueryClient(), {
      ...fakePlatformAdapter(),
      supportsExternalShoppingList,
    }),
  });
}

describe("useGroceryListProvider", () => {
  it("reads builtin while the instance has not answered", () => {
    serveTRPC(() => new Promise(() => undefined));
    const { result } = read();

    expect(result.current).toEqual({
      provider: "builtin",
      isBring: false,
      isLoading: true,
      instanceProvider: "builtin",
    });
  });

  it("is built-in when the instance says so", async () => {
    serveTRPC(async () => "builtin");
    const { result } = read();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toEqual({
      provider: "builtin",
      isBring: false,
      isLoading: false,
      instanceProvider: "builtin",
    });
  });

  it("is Bring! once the instance says so", async () => {
    serveTRPC(async (path) => (path === "config.groceryListProvider" ? "bring" : undefined));
    const { result } = read();

    await waitFor(() => expect(result.current.isBring).toBe(true));
    expect(result.current.provider).toBe("bring");
  });

  describe("on a platform that does not follow the setting", () => {
    it("stays built-in whatever the instance says, and keeps the raw value", async () => {
      serveTRPC(async (path) => (path === "config.groceryListProvider" ? "bring" : undefined));
      const { result } = read(false);

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(result.current).toEqual({
        provider: "builtin",
        isBring: false,
        isLoading: false,
        instanceProvider: "builtin",
      });
    });

    it("does not even ask the instance", async () => {
      const answered = vi.fn(async () => "bring");

      serveTRPC(answered);
      read(false);

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(answered).not.toHaveBeenCalled();
      expect(trpcCalls).toEqual({});
    });

    it("never reports loading, so an add is never held back", () => {
      serveTRPC(() => new Promise(() => undefined));

      expect(read(false).result.current.isLoading).toBe(false);
    });
  });
});
