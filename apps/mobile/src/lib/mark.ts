import { useSyncExternalStore } from "react";

/** A module-scope value with subscribers, read in React through `use`: one tree sets it and another
 * reads it, as the tab bar reads what a screen shows, or it outlives the tree, as Search's state does. */
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
    get: () => value,
    /** Sets the mark from its current value, as a clear that only applies to its own value. */
    update: (change: (current: T) => T) => set(change(value)),
    use: () => useSyncExternalStore(subscribe, () => value),
  };
}
