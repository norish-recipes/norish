import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WakeLockToggle from "@/app/(app)/recipes/[id]/components/wake-lock-toggle";

const toggle = vi.fn();
let isSupported = false;
let isActive = false;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@heroicons/react/20/solid", () => ({
  DevicePhoneMobileIcon: (props: Record<string, unknown>) => <svg {...props} />,
}));

vi.mock("@heroui/react", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Switch: ({ onValueChange }: { onValueChange: () => void }) => (
    <button type="button" onClick={onValueChange}>
      switch
    </button>
  ),
}));

vi.mock("@/app/(app)/recipes/[id]/components/wake-lock-context", () => ({
  useWakeLockContext: () => ({
    isSupported,
    isActive,
    toggle,
  }),
}));

describe("WakeLockToggle", () => {
  beforeEach(() => {
    isSupported = false;
    isActive = false;
    toggle.mockClear();
  });

  it("enables wake lock by default once support is detected", () => {
    const { rerender } = render(<WakeLockToggle />);

    expect(toggle).not.toHaveBeenCalled();

    isSupported = true;
    rerender(<WakeLockToggle />);

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("does not auto-enable again after wake lock was manually turned off", () => {
    isSupported = true;

    const { rerender } = render(<WakeLockToggle />);

    expect(toggle).toHaveBeenCalledTimes(1);

    isActive = true;
    rerender(<WakeLockToggle />);

    isActive = false;
    rerender(<WakeLockToggle />);

    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
