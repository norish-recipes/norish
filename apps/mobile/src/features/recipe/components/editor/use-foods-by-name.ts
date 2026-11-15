import { useEffect, useState } from "react";

import { useIngredientsNamed } from "@norish/shared-react/ingredients";

/** How long typing pauses before a typed name is looked up. */
const FIND_DELAY_MS = 400;

/** The food each typed name names, or null, looked up once typing pauses; it never mints. */
export function useFoodsByName(names: readonly string[]): ReadonlyMap<string, string | null> {
  const key = [...new Set(names.filter((name) => name !== ""))].join("\n");
  const [typed, setTyped] = useState(key);

  useEffect(() => {
    const timer = setTimeout(() => setTyped(key), FIND_DELAY_MS);

    return () => clearTimeout(timer);
  }, [key]);

  return useIngredientsNamed(typed ? typed.split("\n") : []);
}
