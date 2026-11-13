import { useRef } from "react";

/**
 * Wraps an import's press so it runs once while the sheet lives: a second tap during the sheet's
 * exit does nothing. A run that answers false started nothing, so the next tap runs again.
 */
export function useStartOnce() {
  const startedRef = useRef(false);

  return (run: () => boolean | void) => () => {
    if (startedRef.current) return;
    startedRef.current = run() !== false;
  };
}
