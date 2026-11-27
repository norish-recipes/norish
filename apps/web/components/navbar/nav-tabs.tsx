import type { ComponentProps } from "react";
import { useMemo } from "react";
import NextLink from "next/link";
import { SETTINGS_HREF } from "@/components/settings/settings-tab";
import { siteConfig } from "@/config/site";
import { arriveAtTop } from "@/lib/scroll-memory";

import { useGroceryListProvider } from "@norish/shared-react/config";

// Every tab the navbar can show, left to right: the desktop bar shows the nav items, the phone bar
// adds Settings. `useNavTabs` drops the ones an instance does not use.
export const NAV_TABS = [...siteConfig.navItems.map((item) => item.href), SETTINGS_HREF];

const GROCERIES_HREF = "/groceries";

/**
 * The tabs this instance shows: Bring! stands in for the built-in list, so Groceries has no tab
 * there. `items` are the desktop bar's, `tabs` the phone bar's, which adds Settings; the items
 * lead `tabs`, so an item's position is its tab's.
 */
export function useNavTabs() {
  const { isBring } = useGroceryListProvider();

  return useMemo(() => {
    const items = siteConfig.navItems.filter((item) => !(isBring && item.href === GROCERIES_HREF));

    return { items, tabs: [...items.map((item) => item.href), SETTINGS_HREF] };
  }, [isBring]);
}

export const NAV_LABEL_KEYS: Record<string, "home" | "calendar" | "groceries"> = {
  "/": "home",
  "/groceries": "groceries",
  "/calendar": "calendar",
};

/** The first segment of a path, so every page under a tab's section counts as that tab. */
const sectionOf = (path: string) => `/${(path.split("?")[0] ?? path).split("/")[1] ?? ""}`;

/** Which navbar tab a path belongs to, counted from the left, or -1 when it is none of them. */
export function navTabPosition(path: string, tabs: readonly string[] = NAV_TABS) {
  return tabs.map(sectionOf).indexOf(sectionOf(path));
}

/** Whether a tab slides in from the left: it sits left of the current page's tab. */
export function slidesBack(pathname: string, href: string, tabs: readonly string[] = NAV_TABS) {
  return navTabPosition(href, tabs) < navTabPosition(pathname, tabs);
}

/**
 * A navbar tab's link, which opens its page at the top. Next's own scroll skips a page whose top is
 * already in view, which leaves a page that was scrolled a little still scrolled.
 */
export function NavTabLink({
  href,
  pathname,
  onNavigate,
  ...props
}: Omit<ComponentProps<typeof NextLink>, "href"> & { href: string; pathname: string }) {
  const { tabs } = useNavTabs();

  return (
    <NextLink
      {...props}
      href={href}
      scroll={false}
      onNavigate={(event) => {
        onNavigate?.(event);
        arriveAtTop(href, slidesBack(pathname, href, tabs));
      }}
    />
  );
}
