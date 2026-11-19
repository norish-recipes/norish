// @vitest-environment jsdom
import type { ReactNode, Ref } from "react";
import React, { useEffect, useImperativeHandle } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mounts = vi.hoisted(() => new Map<string, number>());
// The column count each FlashList render saw, and a layout cache cleared before it.
const renders = vi.hoisted(() => [] as string[]);

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
    ref: Ref<{ clearLayoutCacheOnUpdate: () => void }>;
    data: unknown[];
    numColumns: number;
    renderItem: (info: { item: unknown; index: number }) => ReactNode;
    keyExtractor: (item: unknown) => string;
  }) => {
    useImperativeHandle(ref, () => ({
      clearLayoutCacheOnUpdate: () => void renders.push("clear"),
    }));
    if (renders.at(-1) !== `${numColumns}`) renders.push(`${numColumns}`);

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

function Card({ id }: { id: string }) {
  useEffect(() => void mounts.set(id, (mounts.get(id) ?? 0) + 1), [id]);

  return null;
}

const scroll = { offset: { value: 0, set: () => {} }, onScroll: undefined, barBottom: 0 } as never;
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
  beforeEach(() => {
    mounts.clear();
    renders.length = 0;
  });

  it("mounts each card once however often the view is toggled", () => {
    const { rerender } = render(list("grid"));

    for (const variant of ["list", "grid", "list", "grid"] as const) rerender(list(variant));

    expect(mounts.size).toBe(ROWS.length);
    expect([...mounts.values()].every((count) => count === 1)).toBe(true);
  });

  it("drops FlashList's layouts before it draws the other view, so a list never keeps grid gaps", () => {
    const { rerender } = render(list("grid"));

    rerender(list("list"));
    rerender(list("grid"));

    expect(renders).toEqual(["2", "clear", "1", "clear", "2"]);
  });
});
