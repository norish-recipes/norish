// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const state = vi.hoisted(() => ({ placement: "regular" as "regular" | "inline" }));

// Layout reports the room and the label's width from `layout`, as UIKit would after a pass.
// A null room is a pass that has not run yet.
const layout = vi.hoisted(() => ({ room: 300 as number | null, label: 100 }));

vi.mock("react-native", async () => {
  const { createElement, useEffect } = await import("react");
  type Measured = { onLayout?: (event: { nativeEvent: { layout: { width: number } } }) => void };
  const useMeasured = ({ onLayout }: Measured, width: number | null) =>
    useEffect(() => {
      if (width !== null) onLayout?.({ nativeEvent: { layout: { width } } });
    }, []);

  return {
    Pressable: (
      props: Measured & {
        children: React.ReactNode;
        accessibilityLabel: string;
        onPress: () => void;
      }
    ) => {
      useMeasured(props, layout.room);

      return createElement(
        "button",
        { "aria-label": props.accessibilityLabel, onClick: props.onPress },
        props.children
      );
    },
    Text: (props: Measured & { children: React.ReactNode; className?: string }) => {
      useMeasured(props, layout.label);

      // The hidden measuring copy is told apart by its onLayout.
      return props.onLayout
        ? null
        : createElement("span", { className: props.className }, props.children);
    },
    View: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  };
});
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/hooks/use-accent-text-color", () => ({ useAccentTextColor: () => "#000" }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("expo-router", () => ({ useRouter: () => router }));
vi.mock("expo-router/native-tabs", () => ({
  NativeTabs: { BottomAccessory: { usePlacement: () => state.placement } },
}));
const { AccessoryAction } = await import("@/features/shell/components/accessory-action");
const { accessoryPlan } = await import("@/features/shell/utils/accessory-plan");

const AddRecipe = () => (
  <AccessoryAction action={accessoryPlan({ path: "/" }, false, "all").add!} />
);

describe("an accessory action", () => {
  beforeEach(() => {
    router.push.mockClear();
    layout.room = 300;
    state.placement = "regular";
  });

  it("opens its route", () => {
    render(<AddRecipe />);
    fireEvent.click(screen.getByRole("button", { name: "recipes.dashboard.addRecipe" }));

    expect(router.push).toHaveBeenCalledWith("/add-recipe");
  });

  it("keeps its label inline where it fits", () => {
    state.placement = "inline";
    render(<AddRecipe />);

    expect(screen.getByRole("button", { name: "recipes.dashboard.addRecipe" }).textContent).toBe(
      "recipes.dashboard.addRecipe"
    );
  });

  it("keeps its name for VoiceOver but draws only the icon inline when the label does not fit", () => {
    layout.room = 120;
    state.placement = "inline";
    render(<AddRecipe />);

    expect(screen.getByRole("button", { name: "recipes.dashboard.addRecipe" }).textContent).toBe(
      ""
    );
  });

  it("holds its label invisible inline until the room is measured, so it never flashes", () => {
    layout.room = null;
    state.placement = "inline";
    render(<AddRecipe />);

    expect(screen.getByText("recipes.dashboard.addRecipe").className).toContain("opacity-0");
  });
});
