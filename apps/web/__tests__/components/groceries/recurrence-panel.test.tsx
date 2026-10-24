/**
 * The repeat panel: picking a frequency is what a recurring grocery saves.
 */
import type { ReactNode } from "react";
import { RecurrencePanel } from "@/components/Panel/consumers/recurrence-panel";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null;

  Panel.Body = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children: ReactNode }) => <div>{children}</div>;

  return { default: Panel, PanelPortal: ({ children }: { children: ReactNode }) => children };
});

vi.mock("@/components/shared/action-button", () => ({
  ActionButton: ({ children, onPress, isDisabled, action }: any) => (
    <button data-testid={`action-${action}`} disabled={isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  ActionButtonGroup: ({ children, start }: { children: ReactNode; start?: ReactNode }) => (
    <div>
      {start}
      {children}
    </div>
  ),
  IconActionButton: ({ label, onPress }: any) => (
    <button aria-label={label} type="button" onClick={onPress} />
  ),
}));

describe("RecurrencePanel", () => {
  it("saves a yearly repeat, with no weekday to pick", async () => {
    const onSave = vi.fn();

    render(<RecurrencePanel open onOpenChange={vi.fn()} onSave={onSave} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("radio", { name: "yearly" }));
    });

    expect(screen.getByText("every year")).toBeInTheDocument();
    expect(screen.queryByText("onDay")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByTestId("action-done"));
    });

    expect(onSave).toHaveBeenCalledWith({ rule: "year", interval: 1, weekday: undefined });
  });
});
