import type { ComponentProps } from "react";
import NextLink from "next/link";
import { siteConfig } from "@/config/site";
import { arriveAtTop } from "@/lib/scroll-memory";

export const SETTINGS_HREF = "/settings?tab=user";

// The navbar's tabs, left to right: the desktop bar shows the nav items, the phone bar adds Settings.
export const NAV_TABS = [...siteConfig.navItems.map((item) => item.href), SETTINGS_HREF];

export const NAV_LABEL_KEYS: Record<string, "home" | "calendar" | "groceries"> = {
  "/": "home",
  "/groceries": "groceries",
  "/calendar": "calendar",
};

const pathOf = (href: string) => href.split("?")[0] ?? href;

/** Which navbar tab a path belongs to, counted from the left, or -1 when it is none of them. */
export function navTabPosition(path: string) {
  const pathname = pathOf(path);

  return NAV_TABS.map(pathOf).findIndex(
    (tab) => pathname === tab || (tab !== "/" && pathname.startsWith(`${tab}/`))
  );
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
