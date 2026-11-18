// @vitest-environment jsdom
import type { ReactNode } from "react";
import React, { useEffect } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mounts = vi.hoisted(() => new Map<string, number>());
const entered = vi.hoisted(() => [] as string[]);
const exited = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/home-indicator", () => ({ homeIndicator: 0 }));
vi.mock("react-native", () => ({ View: ({ children }: { children?: ReactNode }) => children }));
vi.mock("expo-router", () => ({ useIsFocused: () => true }));
vi.mock("react-native-reanimated", async () => {
  const mock = await import("../../../../__tests__/mocks/reanimated");
  const FlatList = ({
    data,
    renderItem,
    keyExtractor,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown }) => ReactNode;
    keyExtractor: (item: unknown, index: number) => string;
  }) =>
    data.map((item, index) => (
      <React.Fragment key={keyExtractor(item, index)}>{renderItem({ item })}</React.Fragment>
    ));

  return { ...mock, default: { ...mock.default, FlatList, View: Passthrough } };

  // Records the card a view mounts with an entering animation, and the one it unmounts with the
  // exiting animation its last commit set, as Reanimated would play them.
  function Passthrough({
    children,
    entering,
    exiting,
  }: {
    children?: ReactNode;
    entering?: object;
    exiting?: object;
  }) {
    const card = React.isValidElement<{ id?: string }>(children) ? children.props.id : undefined;
    const exits = React.useRef(exiting);

    React.useEffect(() => {
      exits.current = exiting;
    });
    React.useEffect(() => {
      if (entering && card) entered.push(card);

      return () => {
        if (exits.current && card) exited.push(card);
      };
    }, []);

    return children;
  }
});
vi.mock("@/components/loader", () => ({ Loader: () => null }));
vi.mock("@/components/tab-list-marker", () => ({
  TabListMarker: ({ children }: never) => children,
}));
vi.mock("@/components/tab-root-header", () => ({ SCROLLED_PAST: 40 }));
vi.mock("@/lib/motion/layout", () => ({
  SPRING_FADE_IN: {},
  SPRING_FADE_OUT: {},
  SPRING_LAYOUT: {},
}));
vi.mock("@/lib/open-row", () => ({ closeOpenRow: () => {} }));
vi.mock("@/lib/tab-bar-placement", () => ({ tabListBottomInset: () => 0 }));
vi.mock("@/lib/tab-accessory-placement", () => ({ useTabBarMinimised: () => false }));

const { CardList } = await import("@/features/recipes/components/card-list");

function Card({ id }: { id: string }) {
  useEffect(() => void mounts.set(id, (mounts.get(id) ?? 0) + 1), [id]);

  return null;
}

const scroll = {
  offset: { value: 0 },
  onScroll: undefined,
  barBottom: 0,
} as never;
const ROWS = Array.from({ length: 20 }, (_, i) => `r${i}`);

const list = (variant: "grid" | "list", rows = ROWS) => (
  <CardList
    empty={<div />}
    fadeHeight={100}
    header={<div />}
    isFetchingNextPage={false}
    renderCard={(id) => <Card id={id} />}
    rowKey={(id) => id}
    rows={rows}
    scroll={scroll}
    variant={variant}
    onEndReached={() => {}}
  />
);

describe("CardList", () => {
  it("mounts each card once however often the view is toggled", () => {
    mounts.clear();
    const { rerender } = render(list("grid"));

    for (const variant of ["list", "grid", "list", "grid"] as const) rerender(list(variant));

    expect(mounts.size).toBe(ROWS.length);
    expect([...mounts.values()].every((count) => count === 1)).toBe(true);
  });

  it("plays the entering animation only for a recipe new to the list", () => {
    entered.length = 0;
    const { rerender } = render(list("list"));

    expect(entered).toEqual(ROWS);
    entered.length = 0;
    // Deleting the first row moves the first card of every later cell into the cell before.
    rerender(list("list", ROWS.slice(1)));
    rerender(list("grid", ROWS.slice(1)));
    expect(entered).toEqual([]);

    rerender(list("grid", [...ROWS.slice(1), "new"]));
    expect(entered).toEqual(["new"]);
  });

  it("plays the exiting animation only for the recipe that left, not for a card moving cells", () => {
    exited.length = 0;
    const { rerender } = render(list("list"));

    // r8 and r16 move up a cell, unmounting from their old one.
    rerender(list("list", ROWS.slice(1)));
    expect(exited).toEqual(["r0"]);
  });
});
