import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * Calls `reopen` when the app returns from the background and when `day` changes, so Today
 * opens on the meal it means now; `inactive` (a sheet, Control Centre) is not a return.
 */
export function useReopenOnNextMeal(reopen: () => void, day: number) {
  const latestRef = useRef(reopen);
  const previousRef = useRef(AppState.currentState);
  const firstDayRef = useRef(day);

  useEffect(() => {
    latestRef.current = reopen;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (previousRef.current === "background" && next === "active") latestRef.current();
      previousRef.current = next;
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (firstDayRef.current === day) return;
    firstDayRef.current = day;
    latestRef.current();
  }, [day]);
}
