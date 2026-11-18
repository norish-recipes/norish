// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Props = {
  renderRightActions: (progress: unknown, translation: unknown, methods: unknown) => ReactNode;
  onSwipeableOpenStartDrag: () => void;
  onSwipeableWillOpen: () => void;
  children?: ReactNode;
};

type Finger = { onTouchesDown: () => void; onTouchesUp: () => void };

const swipe = vi.hoisted(() => ({
  props: null as Props | null,
  finger: null as Finger | null,
  translation: { value: 0, get: () => swipe.translation.value },
  close: vi.fn(),
}));
const haptics = vi.hoisted(() => ({ lightImpact: vi.fn(), mediumImpact: vi.fn() }));

vi.mock("react-native", () => ({
  Text: () => null,
  View: ({ children }: { children?: ReactNode }) => children,
  useWindowDimensions: () => ({ width: 402 }),
}));
vi.mock("react-native-reanimated", async () => {
  const mock = await import("../../../../__tests__/mocks/reanimated");

  return {
    ...mock,
    // One box per component, as Reanimated keeps it across renders.
    useSharedValue: <T,>(value: T) => React.useState(() => mock.useSharedValue(value))[0],
    // As Reanimated does: the reaction runs when what it watches changes, with the value before.
    useAnimatedReaction: <T,>(prepare: () => T, react: (now: T, was: T | null) => void) => {
      const was = React.useRef<T | null>(null);
      const now = prepare();

      if (now !== was.current) react(now, was.current);
      was.current = now;
    },
  };
});
vi.mock("react-native-gesture-handler/ReanimatedSwipeable", () => ({
  default: React.forwardRef((props: Props, ref) => {
    React.useImperativeHandle(ref, () => ({ close: swipe.close }));
    swipe.props = props;

    return (
      <>
        {props.renderRightActions({ value: 1 }, swipe.translation, { close: swipe.close })}
        {props.children}
      </>
    );
  }),
}));
vi.mock("react-native-gesture-handler", () => ({
  GestureDetector: ({ children }: { children?: ReactNode }) => children,
  useManualGesture: (config: Finger) => (swipe.finger = config),
}));
vi.mock("react-native-worklets", () => ({
  scheduleOnRN: (run: () => void) => run(),
}));
vi.mock("@/lib/haptics", () => haptics);
vi.mock("@/components/pressable-scale", () => ({ PressableScale: () => null }));
vi.mock("@/hooks/use-token-color", () => ({ useTokenColor: () => undefined }));
vi.mock("heroui-native", () => ({ useThemeColor: () => ["white"] }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));

const { SwipeActions } = await import("@/features/recipes/components/swipe-actions");

const actions = ["groceries", "plan", "delete"].map((key) => ({
  key: key as "groceries",
  label: key,
  onPress: vi.fn(),
  testID: key,
}));
// A list row with three actions opens at 216 pt; the full swipe is 64 pt further.
const ui = () => (
  <SwipeActions actions={actions} variant="list">
    {null}
  </SwipeActions>
);

const dragTo = (travel: number, rerender: (node: ReactNode) => void) => {
  swipe.translation.value = -travel;
  rerender(ui());
};

describe("SwipeActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swipe.translation.value = 0;
  });

  it("runs the first action once on the release of a full swipe, and closes the row", () => {
    const { rerender } = render(ui());

    act(() => {
      swipe.finger!.onTouchesDown();
      swipe.props!.onSwipeableOpenStartDrag();
    });
    dragTo(300, rerender);
    act(() => swipe.props!.onSwipeableWillOpen());

    expect(actions[0]!.onPress).toHaveBeenCalledTimes(1);
    expect(swipe.close).toHaveBeenCalledTimes(1);
  });

  it("only opens the actions on the release of a swipe short of it", () => {
    const { rerender } = render(ui());

    act(() => {
      swipe.finger!.onTouchesDown();
      swipe.props!.onSwipeableOpenStartDrag();
    });
    dragTo(250, rerender);
    act(() => swipe.props!.onSwipeableWillOpen());

    expect(actions.every((action) => action.onPress.mock.calls.length === 0)).toBe(true);
    expect(swipe.close).not.toHaveBeenCalled();
  });

  it("marks crossing the full swipe each way with a firmer haptic, the open point with a light one", () => {
    const { rerender } = render(ui());

    act(() => {
      swipe.finger!.onTouchesDown();
      swipe.props!.onSwipeableOpenStartDrag();
    });
    dragTo(100, rerender);
    expect(haptics.lightImpact).toHaveBeenCalledTimes(1);

    dragTo(300, rerender);
    dragTo(250, rerender);
    expect(haptics.mediumImpact).toHaveBeenCalledTimes(2);

    // Back short of the full swipe, a release only opens.
    act(() => swipe.props!.onSwipeableWillOpen());
    expect(actions[0]!.onPress).not.toHaveBeenCalled();
  });

  it("runs the first action when the settle after a full swipe moves the card back first", () => {
    const { rerender } = render(ui());

    act(() => {
      swipe.finger!.onTouchesDown();
      swipe.props!.onSwipeableOpenStartDrag();
    });
    dragTo(300, rerender);
    // Released: under Reduce Motion the row is at its open width before "will open" reaches JS.
    act(() => swipe.finger!.onTouchesUp());
    dragTo(216, rerender);
    act(() => swipe.props!.onSwipeableWillOpen());

    expect(actions[0]!.onPress).toHaveBeenCalledTimes(1);
    expect(haptics.mediumImpact).toHaveBeenCalledTimes(1);
  });
});
