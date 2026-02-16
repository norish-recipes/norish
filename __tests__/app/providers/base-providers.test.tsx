import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import { BaseProviders } from "@/app/providers/base-providers";

const toastProviderMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@heroui/system", () => ({
  HeroUIProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@heroui/toast", () => ({
  ToastProvider: (props: unknown) => {
    toastProviderMock(props);

    return null;
  },
}));

vi.mock("@/app/providers/trpc-provider", () => ({
  TRPCProviderWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/timer-dock", () => ({
  TimerDock: () => null,
}));

describe("BaseProviders", () => {
  it("disables toast animations to avoid hover position shifts", () => {
    render(
      <BaseProviders>
        <div>content</div>
      </BaseProviders>
    );

    expect(toastProviderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        disableAnimation: true,
      })
    );
  });
});
