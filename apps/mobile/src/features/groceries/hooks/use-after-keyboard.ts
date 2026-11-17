import { useEffect, useRef } from "react";
import { Keyboard } from "react-native";

/** Runs a change of the sheet's step once the keyboard is down: a fit sheet that resizes while the
 * keyboard hides keeps clipping its content to the height it had above the keyboard. */
export function useAfterKeyboard() {
  const waitingRef = useRef<{ remove: () => void } | null>(null);
  const stopWaiting = () => {
    waitingRef.current?.remove();
    waitingRef.current = null;
  };

  useEffect(() => stopWaiting, []);

  return (run: () => void) => {
    stopWaiting();
    if (!Keyboard.isVisible()) return run();
    waitingRef.current = Keyboard.addListener("keyboardDidHide", () => {
      stopWaiting();
      run();
    });
    Keyboard.dismiss();
  };
}
