import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import Panel from "@/components/Panel/Panel";

type MockSheetProps = {
  "aria-label"?: string;
  children?: ReactNode;
  className?: string;
  isOpen?: boolean;
  placement?: string;
  variant?: string;
};

vi.mock("@heroui-pro/react", () => {
  const Root = ({ children, isOpen, placement }: MockSheetProps) => (
    <div data-open={isOpen ? "true" : "false"} data-placement={placement} data-testid="sheet-root">
      {children}
    </div>
  );

  return {
    Sheet: {
      Root,
      NestedRoot: Root,
      Backdrop: ({ children, className, variant }: MockSheetProps) => (
        <div className={className} data-testid="sheet-backdrop" data-variant={variant}>
          {children}
        </div>
      ),
      Content: ({ children, className }: MockSheetProps) => (
        <div className={className} data-testid="sheet-content">
          {children}
        </div>
      ),
      Dialog: ({ "aria-label": ariaLabel, children, className }: MockSheetProps) => (
        <section aria-label={ariaLabel} className={className} role="dialog">
          {children}
        </section>
      ),
      Handle: ({ className }: MockSheetProps) => (
        <div className={className} data-testid="sheet-handle" />
      ),
      CloseTrigger: ({ className }: MockSheetProps) => (
        <button className={className} type="button">
          Close
        </button>
      ),
      Header: ({ children }: MockSheetProps) => <header>{children}</header>,
      Heading: ({ children }: MockSheetProps) => <h2>{children}</h2>,
      Body: ({ children, className }: MockSheetProps) => (
        <div className={className} data-testid="sheet-body">
          {children}
        </div>
      ),
      Footer: ({ children, className }: MockSheetProps) => (
        <footer className={className}>{children}</footer>
      ),
    },
  };
});

describe("Panel", () => {
  it("uses the shared 80dvh height cap and blur backdrop by default", () => {
    render(
      <Panel open title="Filters" onOpenChange={vi.fn()}>
        <Panel.Body>Filter controls</Panel.Body>
        <Panel.Footer>
          <button type="button">Apply</button>
        </Panel.Footer>
      </Panel>
    );

    expect(screen.getByTestId("sheet-backdrop")).toHaveAttribute("data-variant", "blur");
    expect(screen.getByTestId("sheet-content")).toHaveClass("max-h-[80dvh]");
    expect(screen.getByRole("dialog", { name: "Filters" })).toHaveClass("max-h-[80dvh]");
    expect(screen.getByTestId("sheet-body")).toHaveClass("min-h-0");
  });

  it("still allows a deliberate backdrop override", () => {
    render(
      <Panel backdropVariant="transparent" open title="Calendar" onOpenChange={vi.fn()}>
        <Panel.Body>Calendar controls</Panel.Body>
      </Panel>
    );

    expect(screen.getByTestId("sheet-backdrop")).toHaveAttribute("data-variant", "transparent");
  });
});
