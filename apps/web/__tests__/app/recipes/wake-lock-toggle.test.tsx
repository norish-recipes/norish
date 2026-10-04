import WakeLockToggle from "@/app/(app)/recipes/[id]/components/wake-lock-toggle";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toggle = vi.fn();
const mockToast = vi.fn();
let isSupported = false;
let isActive = false;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@heroicons/react/20/solid", () => ({
  DevicePhoneMobileIcon: (props: Record<string, unknown>) => <svg {...props} />,
}));

vi.mock("@heroui/react", () => {
  const Button = ({
    onPress,
    onClick,
    children,
    isDisabled,
    "aria-label": ariaLabel,
    "aria-pressed": ariaPressed,
    className,
    variant,
  }: {
    onPress?: () => void;
    onClick?: () => void;
    children?: React.ReactNode;
    isDisabled?: boolean;
    "aria-label"?: string;
    "aria-pressed"?: boolean;
    className?: string;
    variant?: string;
  }) => (
    <button
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      className={className}
      data-variant={variant}
      disabled={isDisabled}
      type="button"
      onClick={onPress || onClick}
    >
      {children}
    </button>
  );

  return {
    Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Button,
    toast: (...args: unknown[]) => mockToast(...args),
  };
});

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
    mockToast.mockClear();
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

  it("shows active toast when manually turning wake lock on", async () => {
    isSupported = true;
    isActive = false;

    const { getByRole } = render(<WakeLockToggle autoEnable={false} />);
    const button = getByRole("button");
    expect(button.getAttribute("aria-label")).toBe("ariaLabel");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(button.getAttribute("data-variant")).toBe("secondary");

    button.click();

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith("activeToast");
  });

  it("shows inactive toast when manually turning wake lock off", async () => {
    isSupported = true;
    isActive = true;

    const { getByRole } = render(<WakeLockToggle autoEnable={false} />);
    const button = getByRole("button");
    expect(button.getAttribute("aria-label")).toBe("ariaLabel");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.getAttribute("data-variant")).toBe("primary");

    button.click();

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith("inactiveToast");
  });
});
