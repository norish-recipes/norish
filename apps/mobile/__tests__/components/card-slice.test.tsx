// @vitest-environment jsdom
import React, { useState } from "react";
import { ItemSlice } from "@/components/card-slice";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const lift = vi.hoisted(() => ({ lifted: false as "carried" | "ghost" | false }));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    View: ({
      children,
      className,
      collapsable,
    }: {
      children: React.ReactNode;
      className?: string;
      collapsable?: boolean;
    }) =>
      createElement(
        "div",
        { className, "data-collapsable": String(collapsable ?? true) },
        children
      ),
  };
});
vi.mock("react-native-reanimated", () => import("../mocks/reanimated"));
vi.mock("@/components/drag-list/drag-list", () => ({
  useIsLifted: () => lift.lifted !== false,
  useIsCarried: () => lift.lifted === "carried",
  useDragCard: () => undefined,
}));

function Folding() {
  const [open, setOpen] = useState(false);

  return <button onClick={() => setOpen(true)}>{open ? "open" : "closed"}</button>;
}

describe("ItemSlice", () => {
  it("keeps its row's state through a lift and a drop", () => {
    const edge = { top: false, bottom: false };
    const { rerender } = render(
      <ItemSlice edge={edge}>
        <Folding />
      </ItemSlice>
    );

    fireEvent.click(screen.getByRole("button"));
    lift.lifted = "ghost";
    rerender(
      <ItemSlice edge={edge}>
        <Folding />
      </ItemSlice>
    );
    expect(screen.getByRole("button").textContent).toBe("open");

    lift.lifted = false;
    rerender(
      <ItemSlice edge={edge}>
        <Folding />
      </ItemSlice>
    );
    expect(screen.getByRole("button").textContent).toBe("open");
  });

  // Fabric re-parents a flattened slice's row as it restyles, which cancels the hold's gesture.
  it("keeps the faded copy's inset, hairline width and native tree", () => {
    const edge = { top: false, bottom: false };
    // Every view's classes, outermost first, and which ones Fabric may flatten away.
    const drawn = () => {
      const views = [...container.querySelectorAll("div")];

      return {
        classes: views.map((view) => view.className),
        flattened: views.map((view) => view.dataset.collapsable),
      };
    };

    lift.lifted = false;
    const { container, rerender } = render(<ItemSlice edge={edge}>row</ItemSlice>);
    const resting = drawn();

    lift.lifted = "ghost";
    rerender(<ItemSlice edge={edge}>row</ItemSlice>);
    const ghost = drawn();

    expect(ghost.classes[0]).toBe(resting.classes[0]);
    expect(resting.classes[1]).toContain("border-t");
    expect(ghost.classes[1]).toContain("border-t border-transparent");
    expect(ghost.classes[1]).not.toContain("shadow");
    expect(ghost.flattened).toEqual(resting.flattened);
    expect(resting.flattened[1]).toBe("false");

    lift.lifted = "carried";
    rerender(<ItemSlice edge={edge}>row</ItemSlice>);
    expect(drawn().classes[1]).toContain("shadow-lg");
    expect(drawn().classes[1]).toContain("border-t border-transparent");
  });
});
