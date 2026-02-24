"use client";

import { useMemo } from "react";

interface UseDirtyStateOptions<Current, Initial = Current> {
  normalizeCurrent?: (value: Current) => unknown;
  normalizeInitial?: (value: Initial) => unknown;
  isEqual?: (left: unknown, right: unknown) => boolean;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
    return false;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => deepEqual(value, right[index]));
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(rightRecord, key) &&
      deepEqual(leftRecord[key], rightRecord[key])
  );
}

export function isDirtyState<Current, Initial = Current>(
  current: Current,
  initial: Initial,
  options: UseDirtyStateOptions<Current, Initial> = {}
): boolean {
  const { normalizeCurrent, normalizeInitial, isEqual = deepEqual } = options;
  const normalizedCurrent = normalizeCurrent ? normalizeCurrent(current) : current;
  const normalizedInitial = normalizeInitial ? normalizeInitial(initial) : initial;

  return !isEqual(normalizedCurrent, normalizedInitial);
}

export function useDirtyState<Current, Initial = Current>(
  current: Current,
  initial: Initial,
  options: UseDirtyStateOptions<Current, Initial> = {}
): boolean {
  const { normalizeCurrent, normalizeInitial, isEqual } = options;

  return useMemo(
    () => isDirtyState(current, initial, { normalizeCurrent, normalizeInitial, isEqual }),
    [current, initial, normalizeCurrent, normalizeInitial, isEqual]
  );
}
