/** The ticks of the groceries panel: where they start, and how they follow a line between sections. */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLineSelection } from "../use-line-selection";

const oil = { id: "oil" };
const chicken = { id: "chicken" };
const salt = { id: "salt" };

type Props = {
  toBuy: { id: string }[];
  inPantry: { id: string }[];
  pantryLoading?: boolean;
  pantryUnavailable?: boolean;
};

function setup(initial: Props) {
  // The lists keep their identity while nothing changes, as the panel's lines do between renders.
  return renderHook(
    (props: Props) =>
      useLineSelection({
        lines: [...props.toBuy, ...props.inPantry],
        toBuy: props.toBuy,
        inPantry: props.inPantry,
        pantryLoading: props.pantryLoading ?? false,
        pantryUnavailable: props.pantryUnavailable ?? false,
      }),
    { initialProps: initial }
  );
}

describe("useLineSelection", () => {
  it("starts with what is to buy ticked and what the Pantry holds not", () => {
    const { result } = setup({ toBuy: [chicken], inPantry: [oil, salt] });

    expect(result.current.selectedIds).toEqual(["chicken"]);
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.inPantrySelectedCount).toBe(0);
  });

  it("ticks nothing until the Pantry has answered", () => {
    const { result, rerender } = setup({ toBuy: [chicken], inPantry: [oil], pantryLoading: true });

    expect(result.current.selectedIds).toEqual([]);

    rerender({ toBuy: [chicken], inPantry: [oil] });

    expect(result.current.selectedIds).toEqual(["chicken"]);
  });

  it("ticks nothing when the Pantry cannot be read", () => {
    const { result } = setup({ toBuy: [chicken, oil], inPantry: [], pantryUnavailable: true });

    expect(result.current.selectedIds).toEqual([]);
  });

  it("ticks everything when the Pantry has none of it", () => {
    const { result } = setup({ toBuy: [oil, chicken, salt], inPantry: [] });

    expect(result.current.selectedCount).toBe(3);
  });

  it("unticks a line the Pantry claims while the panel is open", () => {
    const { result, rerender } = setup({ toBuy: [oil, chicken], inPantry: [] });

    expect(result.current.isSelected("oil")).toBe(true);

    rerender({ toBuy: [chicken], inPantry: [oil] });

    expect(result.current.isSelected("oil")).toBe(false);
    expect(result.current.isSelected("chicken")).toBe(true);
  });

  it("ticks a line the Pantry gives back while the panel is open", () => {
    const { result, rerender } = setup({ toBuy: [chicken], inPantry: [oil, salt] });

    expect(result.current.isSelected("oil")).toBe(false);

    rerender({ toBuy: [chicken, oil], inPantry: [salt] });

    expect(result.current.isSelected("oil")).toBe(true);
    expect(result.current.selectedCount).toBe(2);
  });

  it("ticks a new line with its section's default", () => {
    const { result, rerender } = setup({ toBuy: [chicken], inPantry: [oil] });

    rerender({ toBuy: [chicken, salt], inPantry: [oil] });

    expect(result.current.isSelected("salt")).toBe(true);
    expect(result.current.isSelected("oil")).toBe(false);
  });

  it("toggles a line, and leaves an id of a vanished line out of the count", () => {
    const { result, rerender } = setup({ toBuy: [chicken, salt], inPantry: [] });

    act(() => result.current.toggleSelect("salt"));
    expect(result.current.isSelected("salt")).toBe(false);
    act(() => result.current.toggleSelect("salt"));
    expect(result.current.isSelected("salt")).toBe(true);

    rerender({ toBuy: [chicken], inPantry: [] });

    expect(result.current.selectedCount).toBe(1);
  });

  it("select-all of a section ticks or unticks that section and leaves the other as it was", () => {
    const toBuy = [chicken];
    const inPantry = [oil, salt];
    const { result } = setup({ toBuy, inPantry });

    act(() => result.current.toggleSection(inPantry, toBuy));
    expect(result.current.isSelected("oil")).toBe(true);
    expect(result.current.isSelected("salt")).toBe(true);
    expect(result.current.isSelected("chicken")).toBe(true);

    act(() => result.current.toggleSection(inPantry, toBuy));
    expect(result.current.inPantrySelectedCount).toBe(0);
    expect(result.current.isSelected("chicken")).toBe(true);

    act(() => result.current.toggleSection(toBuy, inPantry));
    expect(result.current.selectedCount).toBe(0);
  });
});
