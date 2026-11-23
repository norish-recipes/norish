import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { useLocaleSave, usePreferencesMutation } from "..";
import {
  answerCall,
  answerRead,
  failCall,
  keyOf,
  resetTRPCFake,
  sentCall,
} from "../../trpc/testing";

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

const PROFILE_KEY = keyOf("user.get");
const profile = (locale: string, version: number) => ({
  user: { version, preferences: { locale } },
  apiKeys: [],
});
const held = (queryClient: ReturnType<typeof createTestQueryClient>) =>
  queryClient.getQueryData<ReturnType<typeof profile>>(PROFILE_KEY);

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

  it("shows the language in the profile at once, so a sync from the server's copy keeps it", () => {
    const { queryClient, result } = render(true);

    queryClient.setQueryData(PROFILE_KEY, profile("en", 4));
    act(() => result.current("nl"));

    expect(held(queryClient)?.user.preferences.locale).toBe("nl");
  });

  it("takes the version and language the server answers with, a stale answer's too", async () => {
    const { queryClient, result } = render(true);

    queryClient.setQueryData(PROFILE_KEY, profile("en", 4));
    act(() => result.current("nl"));
    await answerCall("user.updatePreferences", {
      success: true,
      stale: true,
      preferences: { locale: "de" },
      version: 6,
    });

    await waitFor(() => expect(held(queryClient)?.user).toMatchObject({ version: 6 }));
    expect(held(queryClient)?.user.preferences.locale).toBe("de");
  });

  it("counts as a preferences save, so no other one goes at the same version meanwhile", async () => {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(PROFILE_KEY, profile("en", 4));
    const { result } = renderHook(
      () => ({ save: useLocaleSave(true), preferences: usePreferencesMutation() }),
      { wrapper: createTestWrapper(queryClient, fakePlatformAdapter()) }
    );

    act(() => result.current.save("nl"));

    await waitFor(() => expect(result.current.preferences.isUpdatingPreferences).toBe(true));
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

  it("rejects nothing when a save fails", async () => {
    const rejected = vi.fn();

    process.on("unhandledRejection", rejected);
    try {
      const { result } = render(false);

      act(() => result.current("fr"));
      await failCall("user.updatePreferences");
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(rejected).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", rejected);
    }
  });
});
