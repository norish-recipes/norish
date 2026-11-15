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

/** Reports a field that took focus, so the editor can bring it into view. */
export const FocusedFieldContext = createContext<((field: Measurable) => void) | null>(null);

/** The drag scroll view's ref, typed with the methods its instance has at runtime. */
type ScrollHandle = ComponentRef<typeof DragScrollView> & ComponentRef<typeof ScrollView>;

/**
 * Keeps the focused field above the keyboard and the floating pill. iOS lifts a field above the
 * keyboard only as the keyboard opens, and never past a control floating over the content.
 */
export function useFocusedFieldInView(clearance: number) {
  const scrollRef = useRef<ScrollHandle>(null);
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

      if (overlap > 0) scrollRef.current?.scrollTo({ y: offset.value + overlap, animated: true });
    });
  };
  const onKeyboardShown = useEffectEvent(reveal);

  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => onKeyboardShown());

    return () => shown.remove();
  }, []);

  const onFieldFocus = (field: Measurable) => {
    focusedRef.current = field;
    // After the frame that laid the field out, as a row revealed by Return is new.
    requestAnimationFrame(reveal);
  };

  // A row focused by Return or a growing popup moves once the content has grown under it.
  return { scrollRef, onScroll, onFieldFocus, onContentSizeChange: () => reveal() };
}
