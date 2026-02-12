import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import PreferencesCard from "@/app/(app)/settings/user/components/preferences-card";

const mockContext = vi.hoisted(() => ({
  user: { preferences: { timersEnabled: true } },
  updatePreferences: vi.fn().mockResolvedValue(undefined),
  isUpdatingPreferences: false,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/app/(app)/settings/user/context", () => ({
  useUserSettingsContext: () => ({ ...mockContext, user: mockContext.user }),
}));

let timersMock = { timersEnabled: true, globalEnabled: true } as any;

vi.mock("@/hooks/config", () => ({
  useTimersEnabledQuery: () => timersMock,
}));

vi.mock("@heroui/react", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardBody: ({ children }: any) => <div>{children}</div>,
  Switch: ({ isSelected, isDisabled, onValueChange }: any) => (
    <button
      aria-pressed={isSelected}
      disabled={isDisabled}
      onClick={() => onValueChange?.(!isSelected)}
    >
      toggle
    </button>
  ),
}));

describe("PreferencesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows enabled when user preference is true and no global disable", async () => {
    mockContext.user = { preferences: { timersEnabled: true } } as any;

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    // Description should be visible
    expect(screen.getByText("description")).toBeInTheDocument();

    // Locate the timers section parent container (contains the toggle)
    // Find all toggles; timers toggle should be first
    const toggles = screen.getAllByRole("button", { name: /toggle/i });
    const timersToggle = toggles[0];

    expect(timersToggle).toHaveAttribute("aria-pressed", "true");
    expect(timersToggle).not.toBeDisabled();
  });

  it("shows disabled (user-level) when user preference is false and global enabled", async () => {
    mockContext.user = { preferences: { timersEnabled: false } } as any;

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    const toggles = screen.getAllByRole("button", { name: /toggle/i });
    const timersToggle = toggles[0];

    expect(timersToggle).toHaveAttribute("aria-pressed", "false");
    expect(timersToggle).not.toBeDisabled();

    fireEvent.click(timersToggle);

    await waitFor(() => {
      expect(mockContext.updatePreferences).toHaveBeenCalledWith({ timersEnabled: true });
    });
  });

  it("hides the timer toggle when globally disabled", async () => {
    // Set global disabled
    timersMock = { timersEnabled: false, globalEnabled: false } as any;

    render(<PreferencesCard />);

    // The card description should remain visible
    expect(screen.getByText("description")).toBeInTheDocument();

    // Timer toggle should not be rendered, but conversion toggle may still be present
    const titleDiv = screen.queryByText("timers.title");
    const timersToggle = titleDiv?.closest("div")?.parentElement?.querySelector("button") ?? null;
    expect(timersToggle).toBeNull();
  });
});
