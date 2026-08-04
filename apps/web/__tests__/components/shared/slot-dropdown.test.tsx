/**
 * Overlays opened inside a Panel must render inside the Panel.
 *
 * Reported as "adding a recipe to the calendar from the detail page is broken"
 * (#511): the slot menu opened and rendered, but no click ever landed. vaul's
 * drawer is a Radix modal layer, and Radix sets `pointer-events: none` on
 * <body> to hold the page inert behind it. An overlay portalled to <body> is a
 * sibling of the drawer rather than a descendant, so it inherits that
 * inertness. Choosing a slot did nothing.
 *
 * Verified in a real browser at 390x844: with a Panel open, the menu, a select
 * and a date picker portalled to <body> all compute `pointer-events: none`,
 * and every click is swallowed. The fault is general, so the assertion here is
 * the behaviour and not the wiring: the overlay is a descendant of the Panel's
 * own element. Capturing the container prop from a mock — what this file used
 * to do — would pass just as happily if the prop stopped being honoured.
 *
 * jsdom has no hit testing, so containment is the strongest claim it can make;
 * that clicks then land is what the browser run established.
 */
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import Panel from "@/components/Panel/Panel";
import { SlotDropdown } from "@/components/shared/slot-dropdown";
import { Button } from "@heroui/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

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

beforeAll(() => {
  // React Aria scrolls the focused option into view when a menu opens, and
  // jsdom has no Element.scrollTo — which surfaces as an unhandled error rather
  // than a failure, so it has to be stubbed rather than ignored.
  Element.prototype.scrollTo ??= () => {};
});

async function openMenu() {
  await userEvent.click(screen.getByRole("button", { name: "trigger" }));
}

describe("a slot menu opened inside a Panel", () => {
  it("renders inside the Panel", async () => {
    render(
      <Panel open title="Plan">
        <Panel.Body>
          <SlotDropdown onSelectSlot={vi.fn()}>
            <Button>trigger</Button>
          </SlotDropdown>
        </Panel.Body>
      </Panel>
    );

    await openMenu();

    const menu = await screen.findByRole("menu");

    expect(screen.getByTestId("panel-content")).toContainElement(menu);
  });

  it("keeps the default container outside a Panel", async () => {
    render(
      <SlotDropdown onSelectSlot={vi.fn()}>
        <Button>trigger</Button>
      </SlotDropdown>
    );

    await openMenu();

    const menu = await screen.findByRole("menu");

    // Nothing to be contained by; the overlay stays where React Aria puts it.
    expect(menu.closest('[data-slot="panel-dialog"]')).toBeNull();
  });

  it("is not claimed by a Panel that has closed", async () => {
    // vaul keeps the content mounted after close, so a closed panel must stop
    // capturing overlays or they portal into a hidden element.
    render(
      <Panel open={false} title="Plan">
        <Panel.Body>
          <SlotDropdown onSelectSlot={vi.fn()}>
            <Button>trigger</Button>
          </SlotDropdown>
        </Panel.Body>
      </Panel>
    );

    await openMenu();

    const menu = await screen.findByRole("menu");

    expect(screen.getByTestId("panel-content")).not.toContainElement(menu);
  });
});
