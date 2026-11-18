// @vitest-environment jsdom
import type { ReactNode } from "react";
import React, { useEffect } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mounts = vi.hoisted(() => new Map<string, number>());

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

  function Passthrough({ children }: { children?: ReactNode }) {
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

const { CardList } = await import("@/features/recipes/components/card-list");

function Card({ id }: { id: string }) {
  useEffect(() => void mounts.set(id, (mounts.get(id) ?? 0) + 1), [id]);

  return null;
}

const scroll = {
  offset: { value: 0 },
  onScroll: undefined,
  minimised: false,
  homeIndicator: 0,
  barBottom: 0,
} as never;
const ROWS = Array.from({ length: 20 }, (_, i) => `r${i}`);

const list = (variant: "grid" | "list") => (
  <CardList
    empty={<div />}
    fadeHeight={100}
    header={<div />}
    isFetchingNextPage={false}
    renderCard={(id) => <Card id={id} />}
    rowKey={(id) => id}
    rows={ROWS}
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
});
