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
  const Switch = ({ onValueChange, onChange, children }: { onValueChange?: () => void; onChange?: () => void; children?: React.ReactNode }) => (
    <button type="button" onClick={onValueChange || onChange}>
      {children || "switch"}
    </button>
  );
  Switch.Content = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  Switch.Control = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  Switch.Thumb = () => <div />;

  return {
    Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Switch,
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
    getByRole("button").click();

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith("activeToast");
  });

  it("shows inactive toast when manually turning wake lock off", async () => {
    isSupported = true;
    isActive = true;

    const { getByRole } = render(<WakeLockToggle autoEnable={false} />);
    getByRole("button").click();

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith("inactiveToast");
  });
});
