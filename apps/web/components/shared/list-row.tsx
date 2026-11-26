import type { ReactNode } from "react";
import { ChevronRightIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@heroui/react";

/** What a row of a `ListFrame` is made of: its height, gap and padding. */
const ROW_CLASS = "flex min-h-12 w-full items-center gap-3 px-4";

/** The bordered frame every list of rows sits in. */
export function ListFrame({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-border border-border divide-y overflow-hidden rounded-xl border">
      {children}
    </ul>
  );
}

type ListRowProps = {
  name: ReactNode;
  /** Beside the name: how many recipes carry it. */
  count?: string;
  /** Before the name: an icon. */
  leading?: ReactNode;
  /** Draws the lock, named by this: the row's entry is read only. */
  lockLabel?: string;
  /** Says the row opens something. */
  chevron?: boolean;
  "data-testid"?: string;
  "data-entry"?: string;
  onPress: () => void;
};

/** One line of a `ListFrame` that opens its entry: a name, its count, a lock or a chevron. */
export function ListRow({
  name,
  count,
  leading,
  lockLabel,
  chevron,
  "data-testid": testId,
  "data-entry": entry,
  onPress,
}: ListRowProps) {
  return (
    <li>
      <button
        className={`${ROW_CLASS} hover:bg-default/40 focus-visible:ring-focus cursor-[var(--cursor-interactive)] text-start transition-colors focus-visible:ring-2 focus-visible:outline-none`}
        data-entry={entry}
        data-testid={testId}
        type="button"
        onClick={onPress}
      >
        {leading}
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {count ? <span className="text-muted text-sm tabular-nums">{count}</span> : null}
        {lockLabel ? (
          <LockClosedIcon
            aria-hidden={false}
            aria-label={lockLabel}
            className="text-muted size-4 shrink-0"
            role="img"
          />
        ) : null}
        {chevron ? (
          <ChevronRightIcon aria-hidden className="text-muted size-4 shrink-0 rtl:rotate-180" />
        ) : null}
      </button>
    </li>
  );
}

/** A row of a `ListFrame` while its entry loads: the row's own height, a name and a count. */
export function ListRowSkeleton() {
  return (
    <li className={ROW_CLASS}>
      <Skeleton className="h-4 w-40 max-w-full rounded-lg" />
      <span className="flex-1" />
      <Skeleton className="h-4 w-12 rounded-lg" />
    </li>
  );
}
