/** The last value a widget or Live Activity was handed, compared by its JSON so an equal push is skipped. */
export function lastPushed<T>() {
  let last: { content: string; value: T } | null = null;

  return {
    get value(): T | null {
      return last?.value ?? null;
    },
    /** Whether `value` is what was last handed. */
    holds: (value: T) => last?.content === JSON.stringify(value),
    record: (value: T) => void (last = { content: JSON.stringify(value), value }),
    forget: () => void (last = null),
  };
}
