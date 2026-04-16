export type MutationOutcome<T = void> =
  | { applied: true; stale: false; value: T }
  | { applied: false; stale: true; value?: T };

export function appliedOutcome<T>(value: T): MutationOutcome<T> {
  return { applied: true, stale: false, value };
}

export function staleOutcome<T>(value?: T): MutationOutcome<T> {
  return { applied: false, stale: true, value };
}
