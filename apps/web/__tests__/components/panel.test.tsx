import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import Panel from "@/components/Panel/Panel";

type MockDrawerProps = {
  "aria-label"?: string;
  children?: ReactNode;
  className?: string;
  "data-variant"?: string;
  open?: boolean;
  repositionInputs?: boolean;
};

vi.mock("vaul", () => {
  const Root = ({ children, open, repositionInputs }: MockDrawerProps) => (
    <div
      data-open={open ? "true" : "false"}
      data-reposition-inputs={repositionInputs === undefined ? "default" : String(repositionInputs)}
      data-testid="drawer-root"
    >
      {children}
    </div>
  );

  return {
    Drawer: {
      Root,
      NestedRoot: Root,
      Portal: ({ children }: MockDrawerProps) => <>{children}</>,
      Overlay: ({ className, "data-variant": dataVariant }: MockDrawerProps) => (
        <div className={className} data-testid="drawer-overlay" data-variant={dataVariant} />
      ),
      Content: ({ "aria-label": ariaLabel, children, className }: MockDrawerProps) => (
        <section aria-label={ariaLabel} className={className} role="dialog">
          {children}
        </section>
      ),
      Title: ({ children, className }: MockDrawerProps) => (
        <h2 className={className}>{children}</h2>
      ),
      Handle: ({ className }: MockDrawerProps) => (
        <div className={className} data-testid="drawer-handle" />
      ),
    },
  };
});

describe("Panel", () => {
  it("uses the shared 80dvh height cap and blur backdrop by default", () => {
    const { container } = render(
      <Panel open title="Filters" onOpenChange={vi.fn()}>
        <Panel.Body>Filter controls</Panel.Body>
        <Panel.Footer>
          <button type="button">Apply</button>
        </Panel.Footer>
      </Panel>
    );

    expect(screen.getByTestId("drawer-overlay")).toHaveAttribute("data-variant", "blur");
    expect(screen.getByRole("dialog", { name: "Filters" })).toHaveClass("max-h-[80dvh]");
    expect(container.querySelector('[data-slot="panel-dialog"]')).toHaveClass("max-h-[80dvh]");
    expect(container.querySelector('[data-slot="panel-body"]')).toHaveClass("min-h-0");
  });

  it("disables vaul input repositioning so iOS keyboard focus cannot scroll the sheet away", () => {
    render(
      <Panel open title="Groceries" onOpenChange={vi.fn()}>
        <Panel.Body>List</Panel.Body>
      </Panel>
    );

    expect(screen.getByTestId("drawer-root")).toHaveAttribute("data-reposition-inputs", "false");
  });

  it("still allows a deliberate backdrop override", () => {
    render(
      <Panel backdropVariant="transparent" open title="Calendar" onOpenChange={vi.fn()}>
        <Panel.Body>Calendar controls</Panel.Body>
      </Panel>
    );

    expect(screen.getByTestId("drawer-overlay")).toHaveAttribute("data-variant", "transparent");
  });
});
