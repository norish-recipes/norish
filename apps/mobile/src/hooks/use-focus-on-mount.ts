import { useEffect, useRef } from "react";

/** A ref whose field is focused on mount, raising the keyboard, unless `enabled` is false. */
export function useFocusOnMount<T extends { focus: () => void }>(enabled = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (enabled) ref.current?.focus();
  }, [enabled]);

  return ref;
}
