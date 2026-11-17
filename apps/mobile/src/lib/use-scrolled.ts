import { useState } from "react";
import { useHeaderHeight } from "expo-router/react-navigation";

/** Whether a tab root's list has scrolled past its rest, for the title that hides then: `onOffset`
 * takes each scroll's `contentOffset.y`, which rests at minus the bar's inset. */
export function useScrolled() {
  const barHeight = useHeaderHeight();
  const [scrolled, setScrolled] = useState(false);

  return { scrolled, onOffset: (y: number) => setScrolled(y > 8 - barHeight) };
}
