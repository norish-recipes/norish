// @vitest-environment jsdom
import type { ReactElement, ReactNode } from "react";
import React from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type Layout = (event: { nativeEvent: { layout: { width: number } } }) => void;

const layouts = vi.hoisted(() => [] as { onLayout: Layout; children: ReactNode }[]);
const window = vi.hoisted(() => ({ width: 402, fontScale: 1 }));

vi.mock("react-native", () => ({
  useWindowDimensions: () => window,
  View: ({
    children,
    onLayout,
    accessibilityElementsHidden,
  }: {
    children?: ReactNode;
    onLayout?: Layout;
    accessibilityElementsHidden?: boolean;
  }) => {
    if (onLayout) layouts.push({ onLayout, children });

    return <div data-hidden={accessibilityElementsHidden ? "" : undefined}>{children}</div>;
  },
}));
vi.mock("@/features/recipes/components/pill", () => ({
  Pill: ({ children }: { children: string }) => <span>{children}</span>,
}));

const { TagChips } = await import("@/features/recipes/components/tag-chips");

// A chip is 10 pt a letter; the line has `room`.
const layOut = (room: number) =>
  act(() => {
    for (const { onLayout, children } of layouts) {
      const chip = children as ReactElement<{ children?: string }> | undefined;
      const text = React.isValidElement(chip) ? chip.props.children : undefined;
      const width = typeof text === "string" ? text.length * 10 : room;

      onLayout({ nativeEvent: { layout: { width } } });
    }
  });
const visibleChips = (container: HTMLElement) =>
  [...container.querySelectorAll("span")]
    .filter((chip) => !chip.closest("[data-hidden]"))
    .map((chip) => chip.textContent);

describe("TagChips", () => {
  it("draws no chip until every chip and the line are measured, then those that fit and +N", () => {
    layouts.length = 0;
    const { container } = render(
      <TagChips
        allergySet={new Set()}
        look="glass"
        tags={["vegan", "quick", "spicy"]}
        testID="tags"
      />
    );

    expect(visibleChips(container)).toEqual([]);

    // 50 + 6 + 20 (+3) fits in 100; a second tag does not.
    layOut(100);
    expect(visibleChips(container)).toEqual(["vegan", "+2"]);
  });

  it("measures +N apart from the tags, so a tag named + keeps its own width", () => {
    layouts.length = 0;
    const { container } = render(
      <TagChips allergySet={new Set()} look="plain" tags={["+", "salad"]} testID="tags" />
    );

    // "+" is 10 pt and "salad" 50: both fit in 66, whatever the +2 chip measures.
    layOut(66);
    expect(visibleChips(container)).toEqual(["+", "salad"]);
  });

  it("measures two tags of one name apart, then drops the hidden row until the font scale changes", () => {
    layouts.length = 0;
    window.fontScale = 1;
    const chips = () => (
      <TagChips allergySet={new Set()} look="glass" tags={["soup", "soup"]} testID="tags" />
    );
    const { container, rerender } = render(chips());

    layOut(100);
    expect(visibleChips(container)).toEqual(["soup", "soup"]);
    expect(container.querySelector("[data-hidden]")).toBeNull();

    window.fontScale = 1.2;
    rerender(chips());
    expect(visibleChips(container)).toEqual([]);
    expect(container.querySelector("[data-hidden]")).not.toBeNull();
  });
});
