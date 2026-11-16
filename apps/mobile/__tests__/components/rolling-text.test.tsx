// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const motion = vi.hoisted(() => ({ reduced: false }));

type Props = { children?: ReactNode; accessibilityLabel?: string };
const host = ({ children, accessibilityLabel }: Props) => (
  <span aria-label={accessibilityLabel}>{children}</span>
);

vi.mock("react-native", () => ({ View: host, Text: host }));
vi.mock("react-native-reanimated", async () => ({
  ...(await import("./../mocks/reanimated")),
  useReducedMotion: () => motion.reduced,
}));

const { RollingText } = await import("@/components/rolling-text");

describe("RollingText", () => {
  it("is one label for the whole value, drawn a slot per character", () => {
    const { container } = render(<RollingText rising={false} value="10:00" />);

    expect(screen.getByLabelText("10:00")).toBeTruthy();
    // Each slot draws its character twice: unseen to size it, and the one that rolls.
    expect(container.textContent).toBe("1100::0000");
  });

  it("pads a number to its slots from the left so a short value keeps its place", () => {
    const { container } = render(<RollingText rising slots={5} value="9:59" />);

    // A figure space is a digit wide, so the blank slot keeps the row's width.
    expect(container.textContent?.startsWith("\u2007\u2007")).toBe(true);
  });

  it("draws plain text under Reduce Motion", () => {
    motion.reduced = true;
    const { container } = render(<RollingText rising value="10:00" />);

    expect(container.textContent).toBe("10:00");
    motion.reduced = false;
  });
});
