/**
 * IconActionButton's tooltip must render inside an open Panel, like every
 * other overlay opened from Panel content (#511, the slot-menu suite has the
 * full story). The button sits inside five Panels (mini-groceries, recurrence,
 * edit-planned-recipe, edit-note, store-manager); a tooltip portalled to
 * <body> under an open drawer inherits `pointer-events: none` and sits below
 * the drawer's z-index, so it renders occluded and inert.
 *
 * jsdom has no hit testing, so containment is the strongest claim it can make.
 */
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import Panel from "@/components/Panel/Panel";
import { IconActionButton } from "@/components/shared/action-button";

/**
 * vaul stubbed down to what matters here: the Content element the Panel hands
 * to overlays, with its ref forwarded as the real one does.
 */
vi.mock("vaul", () => {
  const Root = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    Drawer: {
      Root,
      NestedRoot: Root,
      Portal: ({ children }: { children?: ReactNode }) => <>{children}</>,
      Overlay: () => <div />,
      Content: ({ children, ref }: { children?: ReactNode; ref?: React.Ref<HTMLElement> }) => (
        <section ref={ref as React.Ref<HTMLElement>} data-testid="panel-content" role="dialog">
          {children}
        </section>
      ),
      Title: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
      Handle: () => <div />,
    },
  };
});

async function showTooltip(name: string) {
  // Keyboard focus opens a React Aria tooltip without the hover heuristics.
  // Inside a Panel the close button precedes the content in tab order, so tab
  // until the target button actually holds focus.
  const button = screen.getByRole("button", { name });

  for (let i = 0; i < 10 && document.activeElement !== button; i++) {
    await userEvent.tab();
  }
  expect(button).toHaveFocus();

  return screen.findByRole("tooltip");
}

describe("an IconActionButton tooltip opened inside a Panel", () => {
  it("renders inside the Panel", async () => {
    render(
      <Panel open title="Stores">
        <Panel.Body>
          <IconActionButton action="edit" label="Edit store" />
        </Panel.Body>
      </Panel>
    );

    const tooltip = await showTooltip("Edit store");

    expect(screen.getByTestId("panel-content")).toContainElement(tooltip);
  });

  it("keeps the default container outside a Panel", async () => {
    render(<IconActionButton action="edit" label="Edit store" />);

    const tooltip = await showTooltip("Edit store");

    // Nothing to be contained by; the overlay stays where React Aria puts it.
    expect(tooltip.closest('[data-slot="panel-dialog"]')).toBeNull();
  });
});
