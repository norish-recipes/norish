import type { VirtualItem } from "@tanstack/react-virtual";

import { stripBasePath } from "@norish/shared/lib/base-path";

// The window's last scrollY on each path.
const scrollTops = new Map<string, number>();
// A virtual list's measured rows by list key, so a revisit lays out at the remembered height.
const listRows = new Map<string, VirtualItem[]>();
// Where the navigation in flight should land and which way it slides in, set by its link.
let arrival: { path: string; top: number; back: boolean } | null = null;

const READER_INPUT = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

if (typeof window !== "undefined") {
  addEventListener("scroll", () => scrollTops.set(stripBasePath(location.pathname), scrollY), {
    passive: true,
  });
}

const pathOf = (href: string) => new URL(href, location.href).pathname;

/** Where the reader last left `path`, if they have been there. */
export function lastScrollTop(path: string): number | undefined {
  return scrollTops.get(path);
}

export function rememberListRows(key: string, rows: VirtualItem[]) {
  listRows.set(key, rows);
}

export function rememberedListRows(key: string): VirtualItem[] | undefined {
  return listRows.get(key);
}

/** For a link's `onNavigate`: its page opens at the top, sliding in from the left if `back`. */
export function arriveAtTop(href: string, back: boolean) {
  arrival = { path: pathOf(href), top: 0, back };
}

/** For a back link's `onNavigate`: the page it opens returns to where the reader left it. */
export function arriveWhereLeft(href: string) {
  const path = pathOf(href);

  arrival = { path, top: scrollTops.get(path) ?? 0, back: true };
}

/** Whether the page committing at `pathname` was opened by a link going back. */
export function arrivesBack(pathname: string) {
  return arrival?.path === pathname && arrival.back;
}

/** Scrolls a page that just committed to where its link asked, and returns the cleanup. */
export function scrollOnArrival(pathname: string): (() => void) | undefined {
  const target = arrival;

  arrival = null;
  if (target?.path !== pathname) return;

  return scrollWhenReachable(target.top);
}

// A page can arrive as its loading.tsx skeleton, too short to scroll that far, so this retries as
// the page grows until it gets there or the reader scrolls themselves.
function scrollWhenReachable(top: number) {
  const reached = () => {
    scrollTo(0, top);

    return scrollY >= top - 1;
  };

  if (reached()) return;

  const observer = new ResizeObserver(() => {
    if (reached()) stop();
  });
  const stop = () => {
    observer.disconnect();
    for (const type of READER_INPUT) removeEventListener(type, stop);
  };

  observer.observe(document.body);
  for (const type of READER_INPUT) addEventListener(type, stop, { passive: true });

  return stop;
}
