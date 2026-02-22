"use client";

import { useCallback, useMemo } from "react";
import { useLocalStorage as useLocalStorageBase } from "usehooks-ts";

/**
 * Generic hook for persisting state to localStorage with SSR safety,
 * cross-tab/cross-component synchronization, and optional validation.
 *
 * Wraps usehooks-ts useLocalStorage with validation support.
 *
 * @param key - localStorage key
 * @param defaultValue - Default value when no stored value exists
 * @param validate - Optional validation function to verify stored data shape
 * @returns [value, setValue, clear]
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  validate?: (data: unknown) => T | null
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [rawValue, setRawValue, clearValue] = useLocalStorageBase<T>(key, defaultValue, {
    initializeWithValue: false, // SSR safety
  });

  // Apply validation if provided
  const value = useMemo(() => {
    if (!validate) return rawValue;

    const validated = validate(rawValue);

    return validated !== null ? validated : defaultValue;
  }, [rawValue, validate, defaultValue]);

  // Wrap setValue to handle functional updates with validated value
  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      if (typeof newValue === "function") {
        setRawValue((prev) => {
          const validatedPrev = validate ? (validate(prev) ?? defaultValue) : prev;

          return (newValue as (prev: T) => T)(validatedPrev);
        });
      } else {
        setRawValue(newValue);
      }
    },
    [setRawValue, validate, defaultValue]
  );

  const clear = useCallback(() => {
    clearValue();
  }, [clearValue]);

  return [value, setValue, clear];
}
