/**
 * Slot menus opened inside a Panel must portal into the panel.
 *
 * Reported as "adding a recipe to the calendar from the detail page is broken"
 * (#511): the menu opened and rendered, but no click ever landed. vaul sets
 * `pointer-events: none` on <body> to hold the page inert behind the drawer,
 * and the menu portalled to <body> - outside the drawer - so it inherited that
 * inertness. Choosing a slot did nothing.
 *
 * jsdom has no hit testing, so the guard here is the contract that fixes it:
 * inside a Panel the popover is handed the panel's own element as its portal
 * container; outside one it keeps the default.
 */
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import Panel from "@/components/Panel/Panel";
import { SlotDropdown } from "@/components/shared/slot-dropdown";

/** Portal containers the Dropdown.Popover was rendered with, in order. */
const portalContainers: (Element | undefined)[] = [];

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@heroui/react", () => ({
  Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
  CloseButton: () => <button type="button">close</button>,
  Label: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  Dropdown: Object.assign(({ children }: { children?: ReactNode }) => <div>{children}</div>, {
    Popover: ({
      children,
      UNSTABLE_portalContainer,
    }: {
      children?: ReactNode;
      UNSTABLE_portalContainer?: Element;
    }) => {
      portalContainers.push(UNSTABLE_portalContainer);

      return <div data-testid="popover">{children}</div>;
    },
    Menu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Item: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  }),
}));

vi.mock("vaul", () => {
  const Root = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    Drawer: {
      Root,
      NestedRoot: Root,
      Portal: ({ children }: { children?: ReactNode }) => <>{children}</>,
      Overlay: () => <div />,
      // Forwards the ref, as the real vaul does — that ref is what the panel
      // hands to overlays.
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

describe("SlotDropdown portal container", () => {
  beforeEach(() => {
    portalContainers.length = 0;
  });

  it("keeps the default container outside a Panel", () => {
    render(
      <SlotDropdown onSelectSlot={vi.fn()}>
        <button type="button">trigger</button>
      </SlotDropdown>
    );

    expect(portalContainers.at(-1)).toBeUndefined();
  });

  it("portals into the panel when opened inside one", () => {
    render(
      <Panel open title="Plan">
        <Panel.Body>
          <SlotDropdown onSelectSlot={vi.fn()}>
            <button type="button">trigger</button>
          </SlotDropdown>
        </Panel.Body>
      </Panel>
    );

    expect(portalContainers.at(-1)).toBe(screen.getByTestId("panel-content"));
  });

  it("does not capture overlays once the panel is closed", () => {
    // vaul keeps the content mounted after close; a closed panel must not go on
    // claiming overlays.
    render(
      <Panel open={false} title="Plan">
        <Panel.Body>
          <SlotDropdown onSelectSlot={vi.fn()}>
            <button type="button">trigger</button>
          </SlotDropdown>
        </Panel.Body>
      </Panel>
    );

    expect(portalContainers.at(-1)).toBeUndefined();
  });
});
