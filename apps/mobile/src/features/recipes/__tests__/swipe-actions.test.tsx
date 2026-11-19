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
  reset: vi.fn(),
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
    default: {
      ...mock.default,
      View: ({
        style,
        testID,
        children,
      }: {
        style?: unknown;
        testID?: string;
        children?: ReactNode;
      }) => (
        <div data-style={JSON.stringify(style)} data-testid={testID}>
          {children}
        </div>
      ),
    },
    useAnimatedStyle: <T,>(style: () => T) => style(),
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
    React.useImperativeHandle(ref, () => ({ close: swipe.close, reset: swipe.reset }));
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
type Handle = import("@/features/recipes/components/swipe-actions").SwipeActionsHandle;

const actions = ["groceries", "plan", "delete"].map((key) => ({
  key: key as "groceries",
  label: key,
  onPress: vi.fn(),
  testID: key,
}));
// A list row with three actions opens at 216 pt; the full swipe is 64 pt further.
const ui = (ref?: React.Ref<Handle>, itemKey = "r1") => (
  <SwipeActions ref={ref} actions={actions} itemKey={itemKey} variant="list">
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

  it("runs the outermost action once on the release of a full swipe, holding a delete's card open", () => {
    const { rerender } = render(ui());

    act(() => {
      swipe.finger!.onTouchesDown();
      swipe.props!.onSwipeableOpenStartDrag();
    });
    dragTo(300, rerender);
    act(() => swipe.props!.onSwipeableWillOpen());

    expect(actions[2]!.onPress).toHaveBeenCalledTimes(1);
    expect(actions[0]!.onPress).not.toHaveBeenCalled();
    expect(swipe.close).not.toHaveBeenCalled();
  });

  it("closes the row on a full swipe that commits another action", () => {
    const [groceries, plan] = actions;
    const { rerender } = render(
      <SwipeActions actions={[groceries!, plan!]} itemKey="r1" variant="list">
        {null}
      </SwipeActions>
    );

    act(() => {
      swipe.finger!.onTouchesDown();
      swipe.props!.onSwipeableOpenStartDrag();
    });
    swipe.translation.value = -300;
    rerender(
      <SwipeActions actions={[groceries!, plan!]} itemKey="r1" variant="list">
        {null}
      </SwipeActions>
    );
    act(() => swipe.props!.onSwipeableWillOpen());

    expect(plan!.onPress).toHaveBeenCalledTimes(1);
    expect(swipe.close).toHaveBeenCalledTimes(1);
  });

  it("springs a held card back closed when the confirm is cancelled, and ignores a card never held", () => {
    vi.useFakeTimers();
    const ref = React.createRef<Handle>();
    const { queryByTestId, rerender } = render(ui(ref));

    act(() => ref.current!.restore());
    expect(swipe.close).not.toHaveBeenCalled();

    act(() => {
      swipe.finger!.onTouchesDown();
      swipe.props!.onSwipeableOpenStartDrag();
    });
    swipe.translation.value = -300;
    rerender(ui(ref));
    act(() => swipe.props!.onSwipeableWillOpen());
    expect(queryByTestId("card-leaving")).not.toBeNull();

    act(() => ref.current!.restore());
    expect(swipe.close).toHaveBeenCalledTimes(1);
    act(() => void vi.advanceTimersByTime(300));
    expect(queryByTestId("card-leaving")).toBeNull();
    vi.useRealTimers();
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
    expect(actions[2]!.onPress).not.toHaveBeenCalled();
  });

  it("runs the outermost action when the settle after a full swipe moves the card back first", () => {
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

    expect(actions[2]!.onPress).toHaveBeenCalledTimes(1);
    expect(haptics.mediumImpact).toHaveBeenCalledTimes(1);
  });

  it("plays the delete, then slides, collapses and hands over the removal once; a recycled cell draws its new item", () => {
    vi.useFakeTimers();
    const ref = React.createRef<Handle>();
    const remove = vi.fn();
    const { queryByTestId, rerender } = render(ui(ref));

    act(() => ref.current!.leave(remove));
    expect(queryByTestId("card-leaving")).not.toBeNull();
    expect(remove).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(700));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(swipe.reset).toHaveBeenCalledTimes(1);

    // The removed card's cell, recycled for another recipe, is not hidden.
    rerender(ui(ref, "r2"));
    expect(queryByTestId("card-leaving")).toBeNull();
    vi.useRealTimers();
  });

  // The action circles' styles: the only ones that carry a scale beside a translate.
  const circles = (container: HTMLElement) =>
    [...container.querySelectorAll("[data-style]")]
      .map((node) => JSON.parse(node.getAttribute("data-style")!) as { opacity?: number })
      .filter(
        (style) =>
          "transform" in style && (style as { transform: unknown[] }).transform.length === 2
      );

  it("shows every action on a cell reused after a delete", () => {
    vi.useFakeTimers();
    const ref = React.createRef<Handle>();
    const { container, rerender } = render(ui(ref));

    act(() => ref.current!.leave(vi.fn()));
    act(() => void vi.advanceTimersByTime(700));
    rerender(ui(ref, "r2"));
    // The mock's styles only read the values on a render; the real ones follow them.
    rerender(ui(ref, "r2"));
    expect(circles(container).map((style) => style.opacity)).toEqual([1, 1, 1]);

    vi.useRealTimers();
  });

  it("shows every action on a card whose delete failed and came back", () => {
    vi.useFakeTimers();
    const ref = React.createRef<Handle>();
    const { container } = render(ui(ref));

    act(() => ref.current!.leave(vi.fn()));
    act(() => void vi.advanceTimersByTime(1700));
    expect(circles(container).map((style) => style.opacity)).toEqual([1, 1, 1]);
    vi.useRealTimers();
  });

  it("resets a held card's swipe when its cell is reused for another item", () => {
    const { rerender } = render(ui());

    act(() => {
      swipe.finger!.onTouchesDown();
      swipe.props!.onSwipeableOpenStartDrag();
    });
    dragTo(300, rerender);
    act(() => swipe.props!.onSwipeableWillOpen());
    expect(swipe.reset).not.toHaveBeenCalled();

    rerender(ui(undefined, "r2"));
    expect(swipe.reset).toHaveBeenCalledTimes(1);
  });
});
