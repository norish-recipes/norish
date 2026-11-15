import type { DragScrollView } from "@/components/drag-list/drag-list";
import type { ComponentRef } from "react";
import type { ScrollView } from "react-native";
import { createContext, useEffect, useEffectEvent, useRef } from "react";
import { Keyboard } from "react-native";
import { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";

/** Anything that can say where it sits on screen, as a focused field can. */
type Measurable = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void
  ) => void;
};

/** Reports a field that took focus, so the screen can bring it into view. */
export const FocusedFieldContext = createContext<((field: Measurable) => void) | null>(null);

/** The drag scroll view's ref, typed with the methods its instance has at runtime. */
type ScrollHandle = ComponentRef<typeof DragScrollView> & ComponentRef<typeof ScrollView>;

/** A scroll view scrolls to a y, a list (a `DragList` is one) to an offset. */
type Scrollable =
  | { scrollTo: (to: { y: number; animated: boolean }) => void }
  | { scrollToOffset: (to: { offset: number; animated: boolean }) => void };

/** Keeps the focused field above the keyboard and anything floating over the content: iOS lifts a
 * field only as the keyboard opens, and never past a floating control. */
export function useFocusedFieldInView<S extends Scrollable = ScrollHandle>(
  clearance: number,
  /** How long the container keeps resizing after the keyboard shows, as a sheet's padding does. */
  settleMs = 0
) {
  const scrollRef = useRef<S>(null);
  const offset = useSharedValue(0);
  const focusedRef = useRef<Measurable | null>(null);
  const onScroll = useAnimatedScrollHandler((event) => {
    offset.value = event.contentOffset.y;
  });

  const reveal = () => {
    const keyboard = Keyboard.metrics();

    if (!focusedRef.current || !keyboard) return;
    focusedRef.current.measureInWindow((_x, y, _width, height) => {
      const overlap = y + height - (keyboard.screenY - clearance);
      const target: Scrollable | null = scrollRef.current;
      const to = offset.value + overlap;

      if (overlap <= 0 || !target) return;
      if ("scrollToOffset" in target) target.scrollToOffset({ offset: to, animated: true });
      else target.scrollTo({ y: to, animated: true });
    });
  };
  const onKeyboardShown = useEffectEvent(reveal);

  useEffect(() => {
    let settled: ReturnType<typeof setTimeout> | undefined;
    // A scroll before the container has shrunk is clamped short, so it is asked again once settled.
    const shown = Keyboard.addListener("keyboardDidShow", () => {
      onKeyboardShown();
      if (settleMs > 0) settled = setTimeout(() => onKeyboardShown(), settleMs);
    });

    return () => {
      shown.remove();
      clearTimeout(settled);
    };
  }, [settleMs]);

  const onFieldFocus = (field: Measurable) => {
    focusedRef.current = field;
    // After the frame that laid the field out, as a row revealed by Return is new.
    requestAnimationFrame(reveal);
  };

  // A row focused by Return or a growing popup moves once the content has grown under it.
  return { scrollRef, onScroll, onFieldFocus, onContentSizeChange: () => reveal() };
}
