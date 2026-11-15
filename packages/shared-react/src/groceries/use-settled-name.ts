import { useEffect, useState } from "react";

/** How long a shopper stops typing a grocery's name before its food and link are read. */
const LOOKUP_DEBOUNCE_MS = 400;

/** The name once typing has stopped, so it is not looked up once per keystroke. An emptied field
 * asks nothing and settles at once. */
export function useSettledName(name: string): string {
  const [settled, setSettled] = useState(name);

  if (name === "" && settled !== "") setSettled("");

  useEffect(() => {
    if (name === settled) return;
    const timer = setTimeout(() => setSettled(name), LOOKUP_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [name, settled]);

  return settled;
}
