import { BaseProviders } from "@/app/providers/base-providers";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const toastProviderMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@heroui/react", () => ({
  Toast: {
    Provider: (props: unknown) => {
      toastProviderMock(props);

      return null;
    },
  },
}));

vi.mock("@/app/providers/trpc-provider", () => ({
  TRPCProviderWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/timer-dock", () => ({
  TimerDock: () => null,
}));

describe("BaseProviders", () => {
  it("mounts the v3 toast provider at the top edge", () => {
    render(
      <BaseProviders>
        <div>content</div>
      </BaseProviders>
    );

    expect(toastProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        placement: "top",
        maxVisibleToasts: 1,
      })
    );
  });

  it("does not disable toast animations", () => {
    render(
      <BaseProviders>
        <div>content</div>
      </BaseProviders>
    );

    expect(toastProviderMock).toHaveBeenCalledWith(
      expect.not.objectContaining({
        disableAnimation: true,
      })
    );
  });
});
