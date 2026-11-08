import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PlatformProvider, usePlatform } from "@norish/shared-react/platform";
import { fakePlatformAdapter } from "@norish/shared-react/platform/testing";

const adapter = fakePlatformAdapter();

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
