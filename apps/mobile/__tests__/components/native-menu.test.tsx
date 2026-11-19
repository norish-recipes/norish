// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type NativeProps = {
  items: { id: string; title: string; destructive: boolean }[];
  onSelect: (event: { nativeEvent: { id: string } }) => void;
  children?: ReactNode;
};
const native = vi.hoisted(() => ({ props: null as NativeProps | null }));

vi.mock("react-native", () => ({ View: ({ children }: { children?: ReactNode }) => children }));
vi.mock("expo", () => ({
  requireNativeView: () => (props: NativeProps) => {
    native.props = props;

    return props.children;
  },
}));

const { NativeMenu } = await import("@/components/native-menu");

describe("NativeMenu", () => {
  it("hands the native menu its entries and runs the one picked", () => {
    const keep = vi.fn();
    const clear = vi.fn();

    render(
      <NativeMenu
        items={[
          { key: "keep", label: "Keep", onPress: keep },
          { key: "clear", label: "Clear", destructive: true, onPress: clear },
        ]}
        label="Actions"
        testID="menu"
      >
        {null}
      </NativeMenu>
    );

    expect(native.props!.items.map(({ title, destructive }) => [title, destructive])).toEqual([
      ["Keep", false],
      ["Clear", true],
    ]);
    native.props!.onSelect({ nativeEvent: { id: native.props!.items[1]!.id } });
    expect(clear).toHaveBeenCalledTimes(1);
    expect(keep).not.toHaveBeenCalled();
  });

  it("runs the picked entry by its key when the entries moved while the menu was open", () => {
    const keep = vi.fn();
    const clear = vi.fn();
    const menu = (items: { key: string; label: string; onPress: () => void }[]) => (
      <NativeMenu items={items} label="Actions" testID="menu">
        {null}
      </NativeMenu>
    );
    const { rerender } = render(
      menu([
        { key: "keep", label: "Keep", onPress: keep },
        { key: "clear", label: "Clear", onPress: clear },
      ])
    );
    const opened = native.props!.items[1]!.id;

    rerender(
      menu([
        { key: "clear", label: "Clear", onPress: clear },
        { key: "keep", label: "Keep", onPress: keep },
      ])
    );
    native.props!.onSelect({ nativeEvent: { id: opened } });

    expect(clear).toHaveBeenCalledTimes(1);
    expect(keep).not.toHaveBeenCalled();
  });
});
