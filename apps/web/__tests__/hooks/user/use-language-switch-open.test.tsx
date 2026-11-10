/**
 * The avatar menu's language switch reads the saved locale only once the menu opens, so the navbar
 * reads no `user.get` of its own on every page.
 */
import { useLanguageSwitch } from "@/hooks/user/use-language-switch";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/hooks/user/use-user-mutations", () => ({
  useUserMutations: () => ({ updatePreferences: vi.fn(), isUpdatingPreferences: false }),
}));
vi.mock("@norish/shared-react/config", () => ({
  useLocaleConfigQuery: () => ({ enabledLocales: [], isLoading: false }),
}));

describe("useLanguageSwitch", () => {
  it("reads the saved locale only while open", () => {
    const queryClient = createTestQueryClient();
    const fetched: string[] = [];

    queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "fetch") {
        fetched.push((event.query.queryKey[0] as string[]).join("."));
      }
    });
    const { rerender } = renderHook(({ open }) => useLanguageSwitch(open), {
      initialProps: { open: false },
      wrapper: createTestWrapper(queryClient),
    });

    expect(fetched).toEqual([]);

    rerender({ open: true });

    expect(fetched).toEqual(["user.get"]);
  });
});
