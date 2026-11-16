// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type PanEvent = { y: number; translationY: number; velocityY: number };
type PanConfig = Record<
  "onBegin" | "onActivate" | "onUpdate" | "onDeactivate" | "onFinalize",
  ((event: PanEvent) => void) | undefined
>;

const pan = vi.hoisted(() => ({ config: {} as Partial<PanConfig> }));

vi.mock("react-native-reanimated", () => import("../../../../__tests__/mocks/reanimated"));
vi.mock("react-native-worklets", () => ({
  scheduleOnUI: (run: () => void) => run(),
  scheduleOnRN: <A extends unknown[]>(run: (...args: A) => void, ...args: A) => run(...args),
}));
vi.mock("react-native-gesture-handler", () => ({
  usePanGesture: (config: Partial<PanConfig>) => {
    pan.config = config;

    return config;
  },
}));

const { useStepPager } = await import("../hooks/use-step-pager");
const { DRAG_DISTANCE, PEEK_SLOT } = await import("../utils/cook-pager");

const HEIGHT = 600;
const PEEK_Y = HEIGHT - PEEK_SLOT / 2;
const TEXT_Y = HEIGHT / 2;

// The pan's callbacks for one touch, in the order the gesture handler calls them.
function touch(y: number, moves: number[], velocityY = 0) {
  const at = (translationY: number) => ({ y: y + translationY, translationY, velocityY });

  pan.config.onBegin?.(at(0));
  if (moves.length > 0) {
    pan.config.onActivate?.(at(moves[0] ?? 0));
    for (const move of moves) pan.config.onUpdate?.(at(move));
    pan.config.onDeactivate?.(at(moves.at(-1) ?? 0));
  }
  pan.config.onFinalize?.(at(moves.at(-1) ?? 0));
}

function mount(current: number, reduceMotion: boolean) {
  const onStepChange = vi.fn();
  const hook = renderHook(() => useStepPager({ count: 5, current, reduceMotion, onStepChange }));

  hook.result.current.height.set(HEIGHT);

  return { pager: hook.result.current, onStepChange };
}

describe("useStepPager", () => {
  beforeEach(() => {
    pan.config = {};
  });

  it("leaves a spring alone when a touch never drags, so a peek tap mid-flight still pages", () => {
    const { pager, onStepChange } = mount(2, false);

    pager.position.set(1.3);
    touch(PEEK_Y, []);

    expect(onStepChange).not.toHaveBeenCalled();
    expect(pager.position.get()).toBe(1.3);
  });

  it("pages under Reduce Motion from a peek fling without moving the column", () => {
    const { pager, onStepChange } = mount(2, true);

    touch(PEEK_Y, [-12, -40], -6 * DRAG_DISTANCE);

    expect(onStepChange).toHaveBeenCalledWith(3);
    expect(pager.position.get()).toBe(2);
  });

  it("pages under Reduce Motion from the text only at its scroll edge", () => {
    const { pager, onStepChange } = mount(2, true);

    pager.scrollMax.set(400);
    pager.scrollAt.set(120);
    touch(TEXT_Y, [-12, -40], -6 * DRAG_DISTANCE);
    expect(onStepChange).not.toHaveBeenCalled();

    pager.scrollAt.set(400);
    touch(TEXT_Y, [-12, -40], -6 * DRAG_DISTANCE);
    expect(onStepChange).toHaveBeenCalledWith(3);
  });
});
