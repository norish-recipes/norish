import { useEffect, useRef } from "react";

/** A ref whose field takes focus as the sheet opens, raising the keyboard; none when `enabled` is false. */
export function useFocusOnMount<T extends { focus: () => void }>(enabled = true) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (enabled) ref.current?.focus();
  }, [enabled]);

  return ref;
}
