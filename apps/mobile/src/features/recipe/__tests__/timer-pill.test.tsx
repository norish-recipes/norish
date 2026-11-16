// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const passThrough = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
const modifier = () => ({});

vi.mock("react-native", () => ({
  Pressable: passThrough,
  useWindowDimensions: () => ({ width: 400, height: 800 }),
}));
vi.mock("react-native-reanimated", () => import("../../../../__tests__/mocks/reanimated"));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
vi.mock("expo-haptics", () => ({}));
vi.mock("@expo/ui/swift-ui", () => ({
  Host: passThrough,
  HStack: passThrough,
  Rectangle: () => null,
  RNHostView: passThrough,
}));
vi.mock("@expo/ui/swift-ui/modifiers", () => ({
  Animation: {
    linear: () => ({ delay: modifier }),
    interpolatingSpring: () => ({ delay: modifier }),
  },
  animation: modifier,
  contentShape: modifier,
  foregroundStyle: modifier,
  frame: modifier,
  glassEffect: modifier,
  offset: modifier,
  onTapGesture: modifier,
  shapes: { rectangle: modifier },
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@/components/timer-glance", () => ({ TimerGlance: () => null, useTimersLabel: () => "" }));
vi.mock("../components/timer-list", () => ({ AllTimers: () => null }));

const { TimerPill } = await import("../components/timer-pill");
const { useTimerStore } = await import("@norish/shared-react/recipes/timers");

const timer = {
  id: "a",
  recipeId: "r",
  label: "a",
  originalDurationMs: 600_000,
  remainingMs: 300_000,
  status: "running" as const,
  lastTickAt: null,
};

describe("TimerPill", () => {
  beforeEach(() => useTimerStore.setState({ timers: [timer] }));

  it("closes the open list when the last timer goes, though the pill is gone with it", () => {
    const onOpenChange = vi.fn();

    render(
      <TimerPill
        open
        bottom={34}
        height={48}
        left={20}
        listWidth={360}
        testID="pill"
        onOpenChange={onOpenChange}
      />
    );
    act(() => useTimerStore.setState({ timers: [] }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
