import type { ComponentProps } from "react";
import NextLink from "next/link";
import { SETTINGS_HREF } from "@/components/settings/settings-tab";
import { siteConfig } from "@/config/site";
import { arriveAtTop } from "@/lib/scroll-memory";

// The navbar's tabs, left to right: the desktop bar shows the nav items, the phone bar adds Settings.
export const NAV_TABS = [...siteConfig.navItems.map((item) => item.href), SETTINGS_HREF];

export const NAV_LABEL_KEYS: Record<string, "home" | "calendar" | "groceries"> = {
  "/": "home",
  "/groceries": "groceries",
  "/calendar": "calendar",
};

/** The first segment of a path, so every page under a tab's section counts as that tab. */
const sectionOf = (path: string) => `/${(path.split("?")[0] ?? path).split("/")[1] ?? ""}`;

/** Which navbar tab a path belongs to, counted from the left, or -1 when it is none of them. */
export function navTabPosition(path: string) {
  return NAV_TABS.map(sectionOf).indexOf(sectionOf(path));
}

/** Whether a tab slides in from the left: it sits left of the current page's tab. */
export function slidesBack(pathname: string, href: string) {
  return navTabPosition(href) < navTabPosition(pathname);
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
  return (
    <NextLink
      {...props}
      href={href}
      scroll={false}
      onNavigate={(event) => {
        onNavigate?.(event);
        arriveAtTop(href, slidesBack(pathname, href));
      }}
    />
  );
}
