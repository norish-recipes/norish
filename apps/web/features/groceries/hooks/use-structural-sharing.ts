"use client";

import { useState } from "react";
import { replaceEqualDeep } from "@tanstack/react-query";

/**
 * The value, with every part that equals the last render's kept as that same
 * object, as TanStack Query does for query data. A list rebuilt from changed
 * data then hands the rows that did not change the objects they already had,
 * so only the changed rows re-render.
 */
export function useStructuralSharing<T>(next: T): T {
  const [shared, setShared] = useState(next);
  const merged = replaceEqualDeep(shared, next);

  if (merged !== shared) setShared(merged);

  return merged;
}
