// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SwipeActionsPanel } from "../components/swipe-actions-panel";

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    View: ({ children }: { children?: ReactNode }) => createElement("div", null, children),
    Text: ({ children }: { children?: ReactNode }) => createElement("span", null, children),
  };
});
vi.mock("@/components/pressable-scale", async () => {
  const { createElement } = await import("react");

  return {
    PressableScale: ({
      children,
      accessibilityLabel,
    }: {
      children?: ReactNode;
      accessibilityLabel: string;
    }) => createElement("button", { "aria-label": accessibilityLabel }, children),
  };
});
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("../components/use-action-tone", () => ({
  useActionTone: () => () => ({ ground: "", ink: "#000" }),
}));

const methods = { close: vi.fn(), openLeft: vi.fn(), openRight: vi.fn(), reset: vi.fn() };

describe("SwipeActionsPanel", () => {
  it("labels a circle with its short swipe label and speaks the full one", () => {
    render(
      <SwipeActionsPanel
        enabled
        actions={[
          { kind: "admin", label: "Make admin", swipeLabel: "Admin", onPress: vi.fn() },
          { kind: "kick", label: "Kick", onPress: vi.fn() },
        ]}
        methods={methods}
      />
    );

    expect(screen.getByRole("button", { name: "Make admin" }).textContent).toBe("Admin");
    expect(screen.getByRole("button", { name: "Kick" }).textContent).toBe("Kick");
  });
});
