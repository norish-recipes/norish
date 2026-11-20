// @vitest-environment jsdom
import type { ReactNode, Ref } from "react";
import React, { useEffect, useImperativeHandle } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mounts = vi.hoisted(() => new Map<string, number>());
// Each card drawn, as its variant in the column count its list had then.
const drawn = vi.hoisted(() => ({ columns: 0, cards: [] as string[] }));
// The column count each FlashList render saw, and a layout cache cleared before it.
const renders = vi.hoisted(() => [] as string[]);
// Each programmatic scroll's offset.
const scrolls = vi.hoisted(() => [] as number[]);

vi.mock("@/lib/home-indicator", () => ({ homeIndicator: 0 }));
vi.mock("react-native", () => ({ View: ({ children }: { children?: ReactNode }) => children }));
vi.mock("expo-router", () => ({ useIsFocused: () => true }));
vi.mock(
  "react-native-reanimated",
  async () => await import("../../../../__tests__/mocks/reanimated")
);
// Every row drawn under its key, as FlashList keys its cells.
vi.mock("@shopify/flash-list", () => ({
  FlashList: ({
    ref,
    data,
    numColumns,
    renderItem,
    keyExtractor,
  }: {
    ref: Ref<{
      clearLayoutCacheOnUpdate: () => void;
      scrollToOffset: (to: { offset: number }) => void;
    }>;
    data: unknown[];
    numColumns: number;
    renderItem: (info: { item: unknown; index: number }) => ReactNode;
    keyExtractor: (item: unknown) => string;
  }) => {
    useImperativeHandle(ref, () => ({
      clearLayoutCacheOnUpdate: () => void renders.push("clear"),
      scrollToOffset: ({ offset }) => void scrolls.push(offset),
    }));
    if (renders.at(-1) !== `${numColumns}`) renders.push(`${numColumns}`);
    drawn.columns = numColumns;

    return data.map((item, index) => (
      <React.Fragment key={keyExtractor(item)}>{renderItem({ item, index })}</React.Fragment>
    ));
  },
}));
vi.mock("@/components/loader", () => ({ Loader: () => null }));
vi.mock("@/components/tab-list-marker", () => ({
  TabListMarker: ({ children }: never) => children,
}));
vi.mock("@/components/tab-root-header", () => ({ SCROLLED_PAST: 40 }));
vi.mock("@/lib/open-row", () => ({ closeOpenRow: () => {} }));
vi.mock("@/lib/tab-bar-placement", () => ({ tabListBottomInset: () => 0 }));
vi.mock("@/lib/tab-accessory-placement", () => ({ useTabBarMinimised: () => false }));

const { CardList } = await import("@/features/recipes/components/card-list");

function Card({ id, variant }: { id: string; variant: string }) {
  useEffect(() => void mounts.set(id, (mounts.get(id) ?? 0) + 1), [id]);
  drawn.cards.push(`${variant}:${drawn.columns}`);

  return null;
}

const scroll = {
  offset: { value: 0, set: () => {} },
  onScroll: undefined,
  barBottom: 116,
} as never;
const ROWS = Array.from({ length: 20 }, (_, i) => `r${i}`);

const list = (variant: "grid" | "list", query: unknown = "all") => (
  <CardList
    empty={<div />}
    fadeHeight={100}
    header={<div />}
    insets="automatic"
    isFetchingNextPage={false}
    query={query}
    renderCard={(id, shown) => <Card id={id} variant={shown} />}
    rowKey={(id) => id}
    rows={ROWS}
    scroll={scroll}
    variant={variant}
    onEndReached={() => {}}
  />
);

describe("CardList", () => {
  beforeEach(() => {
    mounts.clear();
    renders.length = 0;
    drawn.cards.length = 0;
    scrolls.length = 0;
  });

  it("lands a new query at the automatic inset's rest, and leaves the list be otherwise", () => {
    const { rerender } = render(list("grid", "cookbooks"));

    rerender(list("list", "cookbooks"));
    rerender(list("list", "all"));
    rerender(list("list", "all"));

    expect(scrolls).toEqual([-116]);
  });

  it("mounts every card anew in the view it toggles to, never one view's card in the other's cells", () => {
    const toggles = ["list", "grid", "list", "grid"] as const;
    const { rerender } = render(list("grid"));

    for (const variant of toggles) rerender(list(variant));

    expect([...mounts.values()]).toEqual(ROWS.map(() => toggles.length + 1));
    expect(new Set(drawn.cards)).toEqual(new Set(["grid:2", "list:1"]));
  });

  it("drops FlashList's layouts before it draws the other view, so a list never keeps grid gaps", () => {
    const { rerender } = render(list("grid"));

    rerender(list("list"));
    rerender(list("grid"));

    expect(renders).toEqual(["2", "clear", "1", "clear", "2"]);
  });
});
