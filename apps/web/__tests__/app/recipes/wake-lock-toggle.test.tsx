import WakeLockToggle from "@/app/(app)/recipes/[id]/components/wake-lock-toggle";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toggle = vi.fn();
let isSupported = false;
let isActive = false;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@heroicons/react/20/solid", () => ({
  DevicePhoneMobileIcon: (props: Record<string, unknown>) => <svg {...props} />,
}));

vi.mock("@heroui/react", () => {
  const ToggleButton = ({
    onChange,
    children,
    isSelected,
    "aria-label": ariaLabel,
    "aria-disabled": ariaDisabled,
  }: {
    onChange?: () => void;
    children?: React.ReactNode;
    isSelected?: boolean;
    "aria-label"?: string;
    "aria-disabled"?: boolean;
  }) => (
    <button
      aria-disabled={ariaDisabled}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      type="button"
      onClick={onChange}
    >
      {children}
    </button>
  );
  const Tooltip = Object.assign(
    ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    { Content: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }
  );

  return { Tooltip, ToggleButton };
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

  it("shows whether the screen stays awake, and toggles it", () => {
    isSupported = true;
    isActive = true;

    const { getByRole, getByText } = render(<WakeLockToggle autoEnable={false} />);
    const button = getByRole("button", { name: "ariaLabel" });

    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(getByText("activeTooltip")).toBeTruthy();

    button.click();

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("says why it does nothing where wake lock is not supported", () => {
    const { getByRole, getByText } = render(<WakeLockToggle autoEnable={false} />);
    const button = getByRole("button", { name: "ariaLabel" });

    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(getByText("notSupported")).toBeTruthy();

    button.click();

    expect(toggle).not.toHaveBeenCalled();
  });
});
