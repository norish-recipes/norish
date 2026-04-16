import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "@/lib/storage/mmkv";

import { createUseAmountDisplayPreference } from "@norish/shared-react/hooks";

/**
 * Module-level in-memory cache + subscriber set, keyed by storage key.
 *
 * All hook instances sharing the same key will stay in sync:
 * when one instance writes, every other instance is notified immediately.
 */
const cache = new Map<string, unknown>();
const subscribers = new Map<string, Set<(v: unknown) => void>>();

function notifySubscribers(key: string, value: unknown) {
  cache.set(key, value);
  subscribers.get(key)?.forEach((cb) => cb(value));
}

/**
 * MMKV-backed hook with cross-instance sync.
 *
 * Matches the `useStorage` shape expected by `createUseAmountDisplayPreference`:
 *   [value, setter]  where setter accepts  T | (prev => T)
 */
function useMmkvStorageState<T>(
  key: string,
  defaultValue: T,
  validate?: (data: unknown) => T | null
): [T, (updater: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() =>
    cache.has(key) ? (cache.get(key) as T) : defaultValue
  );

  // Keep a ref to the latest value so the subscriber doesn't cause loops
  const valueRef = useRef(value);
  valueRef.current = value;

  // Subscribe to cross-instance updates
  useEffect(() => {
    const handler = (newValue: unknown) => {
      setValue(newValue as T);
    };

    let subs = subscribers.get(key);
    if (!subs) {
      subs = new Set();
      subscribers.set(key, subs);
    }
    subs.add(handler);

    return () => {
      subs!.delete(handler);
      if (subs!.size === 0) subscribers.delete(key);
    };
  }, [key]);

  // Load persisted value on mount (only if cache is empty)
  useEffect(() => {
    if (cache.has(key)) return; // already hydrated by another instance

    try {
      const raw = storage.getString(key);
      if (raw != null) {
        const parsed: unknown = JSON.parse(raw);
        const validated = validate ? validate(parsed) : (parsed as T);
        if (validated != null) {
          notifySubscribers(key, validated);
        }
      }
    } catch {
      // ignore read errors, use default
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValueAndPersist = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const prev = valueRef.current;
      const next = typeof updater === "function" ? (updater as (prev: T) => T)(prev) : updater;
      storage.set(key, JSON.stringify(next));
      notifySubscribers(key, next);
    },
    [key]
  );

  return [value, setValueAndPersist];
}

export const useAmountDisplayPreference = createUseAmountDisplayPreference({
  useStorage: useMmkvStorageState,
});
