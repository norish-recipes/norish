import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PlatformAdapter } from "@norish/shared-react/platform";
import { PlatformProvider, usePlatform } from "@norish/shared-react/platform";

const adapter: PlatformAdapter = {
  toast: { show: vi.fn(), translate: (id) => id },
  navigation: { toHome: vi.fn(), toRecipe: vi.fn() },
  showError: vi.fn(),
  storage: { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() },
  deviceKind: "phone",
};

describe("the platform adapter", () => {
  it("is what the app mounted", () => {
    const { result } = renderHook(() => usePlatform(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <PlatformProvider adapter={adapter}>{children}</PlatformProvider>
      ),
    });

    result.current.navigation.toRecipe("r1");

    expect(result.current.deviceKind).toBe("phone");
    expect(adapter.navigation.toRecipe).toHaveBeenCalledWith("r1");
  });

  it("is missing without a provider", () => {
    expect(() => renderHook(() => usePlatform())).toThrow();
  });
});
