import { useEffect, useState } from "react";

/** The text once typing has stopped for `delayMs`, so it is not acted on once per keystroke. An
 * emptied field asks nothing and settles at once. */
export function useSettledText(text: string, delayMs: number): string {
  const [settled, setSettled] = useState(text);

  if (text === "" && settled !== "") setSettled("");

  useEffect(() => {
    if (text === settled) return;
    const timer = setTimeout(() => setSettled(text), delayMs);

    return () => clearTimeout(timer);
  }, [text, settled, delayMs]);

  return settled;
}
