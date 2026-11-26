import type { ReactNode } from "react";
import { ChevronRightIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@heroui/react";

/** How far each level of a tree of rows is set in from the one above. */
const INDENT_PX = 24;

/** What a row of a `ListFrame` is made of: its height, gap and padding. */
const LINE_CLASS = "flex min-h-12 w-full items-center gap-3 px-4";
/** The two-line row: a name over a detail, taller and padded to hold both. */
const TWO_LINE_CLASS = "flex min-h-15 w-full items-center gap-3 px-4 py-2";

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
  /** Under the name: a second line, which makes the row a two-line row. */
  detail?: ReactNode;
  /** After the name: a chip or a note about it. */
  badge?: ReactNode;
  /** Beside the name: how many recipes carry it. */
  count?: string;
  /** Before the name: an icon. */
  leading?: ReactNode;
  /** Before the row's button: a control of its own, such as a tree's expander. */
  expander?: ReactNode;
  /** How deep in a tree the row sits. */
  depth?: number;
  /** Draws the lock, named by this: the row's entry is read only. */
  lockLabel?: string;
  /** Says the row opens something. */
  chevron?: boolean;
  id?: string;
  /** On the row itself, whose hover covers the expander and the indent too. */
  rowData?: Record<`data-${string}`, string | boolean | number | undefined>;
  "data-testid"?: string;
  "data-entry"?: string;
  onPress: () => void;
};

/** One line of a `ListFrame` that opens its entry: a name, its count, a lock or a chevron. */
export function ListRow({
  name,
  detail,
  badge,
  count,
  leading,
  expander,
  depth = 0,
  lockLabel,
  chevron,
  id,
  rowData,
  "data-testid": testId,
  "data-entry": entry,
  onPress,
}: ListRowProps) {
  const twoLine = detail !== undefined;

  return (
    <li
      className="hover:bg-default/40 flex items-stretch transition-colors"
      id={id}
      style={depth > 0 ? { paddingInlineStart: `${depth * INDENT_PX}px` } : undefined}
      {...rowData}
    >
      {expander}
      <button
        className={`${twoLine ? TWO_LINE_CLASS : LINE_CLASS} focus-visible:ring-focus cursor-[var(--cursor-interactive)] text-start focus-visible:ring-2 focus-visible:outline-none`}
        data-entry={entry}
        data-testid={testId}
        type="button"
        onClick={onPress}
      >
        {leading}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className={`min-w-0 truncate ${twoLine ? "font-medium" : ""}`}>{name}</span>
            {badge}
          </span>
          {twoLine ? <span className="text-muted text-sm">{detail}</span> : null}
        </span>
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
export function ListRowSkeleton({ leading }: { leading?: ReactNode } = {}) {
  if (leading) {
    return (
      <li className={TWO_LINE_CLASS}>
        {leading}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton className="h-5 w-40 max-w-full rounded-lg" />
          <Skeleton className="h-4 w-56 max-w-full rounded-lg" />
        </div>
      </li>
    );
  }

  return (
    <li className={LINE_CLASS}>
      <Skeleton className="h-4 w-40 max-w-full rounded-lg" />
      <span className="flex-1" />
      <Skeleton className="h-4 w-12 rounded-lg" />
    </li>
  );
}
