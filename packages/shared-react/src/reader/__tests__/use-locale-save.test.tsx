import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@norish/shared-react/platform/testing";

import { useLocaleSave } from "..";
import { answerRead, keyOf, resetTRPCFake, sentCall } from "../../trpc/testing";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

beforeEach(() => resetTRPCFake());

// No platform adapter: mobile's locale context sits above it.
function render(signedIn: boolean) {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, ...renderHook(() => useLocaleSave(signedIn), { wrapper }) };
}

describe("useLocaleSave", () => {
  it("saves a language at the version the profile holds", async () => {
    const { queryClient, result } = render(true);

    await waitFor(() => {
      answerRead("user.get", { user: { version: 4 }, apiKeys: [] });
      expect(queryClient.getQueryData(keyOf("user.get"))).toBeDefined();
    });
    act(() => result.current("nl"));

    expect((await sentCall("user.updatePreferences")).input).toEqual({
      version: 4,
      preferences: { locale: "nl" },
    });
  });

  it("reads no profile while signed out and saves at version 1", async () => {
    const { queryClient, result } = render(false);

    expect(queryClient.isFetching()).toBe(0);
    act(() => result.current("de"));

    expect((await sentCall("user.updatePreferences")).input).toEqual({
      version: 1,
      preferences: { locale: "de" },
    });
  });
});
