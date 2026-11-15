// @vitest-environment jsdom
import React, { useState } from "react";
import { ItemSlice } from "@/components/card-slice";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const lift = vi.hoisted(() => ({ lifted: false }));

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    View: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  };
});
vi.mock("react-native-reanimated", () => ({ useReducedMotion: () => false }));
vi.mock("@/components/drag-list/drag-list", () => ({ useIsLifted: () => lift.lifted }));

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
    lift.lifted = true;
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
});
