import { useSyncExternalStore } from "react";

/** A value one React tree sets and another reads, as the tab bar reads what a screen shows. The
 * setter owns clearing it, so a mark never outlives the screen that set it. */
export function createMark<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);

    return () => void listeners.delete(listener);
  };

  const set = (next: T) => {
    value = next;
    listeners.forEach((listener) => listener());
  };

  return {
    set,
    /** Sets the mark from its current value, as a clear that only applies to its own value. */
    update: (change: (current: T) => T) => set(change(value)),
    use: () => useSyncExternalStore(subscribe, () => value),
  };
}
