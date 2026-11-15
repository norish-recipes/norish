import { useRef } from "react";
import { useRouter } from "expo-router";

/** Wraps an import's press: it runs once and closes the sheet, so a tap during the exit does nothing.
 * A run that answers false started nothing; the sheet stays and the next tap runs again. */
export function useStartImport() {
  const router = useRouter();
  const startedRef = useRef(false);

  return (run: () => boolean | void) => () => {
    if (startedRef.current) return;
    startedRef.current = run() !== false;
    if (startedRef.current) router.back();
  };
}
