"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  NAV_LABEL_KEYS,
  NAV_TABS,
  NavTabLink,
  navTabPosition,
  SETTINGS_HREF,
} from "@/components/navbar/nav-tabs";
import NavbarUserMenu from "@/components/navbar/navbar-user-menu";
import { useAutoHide } from "@/hooks/auto-hide";
import {
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  HomeIcon,
} from "@heroicons/react/20/solid";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import { cssFloatingDockEndCap, MOBILE_NAV_SHRUNKEN_SCALE } from "@norish/web/config/css-tokens";

const TAB_ICONS: Record<string, typeof HomeIcon> = {
  "/": HomeIcon,
  "/groceries": ClipboardDocumentListIcon,
  "/calendar": CalendarDaysIcon,
  [SETTINGS_HREF]: Cog6ToothIcon,
};

// Both floating pieces share one solid treatment on the chrome tokens — the
// opposite theme's ground — so the bar contrasts with the cards scrolling
// under it (ADR-0020).
const barSurfaceClassName =
  "bg-chrome border-chrome-border rounded-full border shadow-[0_8px_28px_-10px_rgba(0,0,0,0.3)]";

// A pill rather than a circle, the same size as the one sliding behind the active tab.
const tabClassName = "flex items-center justify-center rounded-full px-5 py-2.5";
const idleTabClassName = "text-chrome-muted hover:text-chrome-foreground hover:bg-chrome-hover";

export const MobileNav = () => {
  const tNav = useTranslations("navbar.nav");
  const tMenu = useTranslations("navbar.userMenu");
  const pathname = usePathname();
  const activeTab = navTabPosition(pathname);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { isVisible, show } = useAutoHide({
    disabled: userMenuOpen,
  });

  // Keep visible while user menu is open
  useEffect(() => {
    if (userMenuOpen) {
      show();
    }
  }, [userMenuOpen, show]);

  // Close user menu callback
  const closeUserMenu = useCallback(() => {
    if (userMenuOpen) {
      setUserMenuOpen(false);
    }
  }, [userMenuOpen, setUserMenuOpen]);

  return (
    <>
      {/* Backdrop overlay - blocks page interactions when menu is open */}
      <AnimatePresence>
        {userMenuOpen && (
          <motion.div
            key="mobile-nav-backdrop"
            animate={{ opacity: 1 }}
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/30 md:hidden"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeUserMenu}
            onTouchEnd={closeUserMenu}
          />
        )}
      </AnimatePresence>

      {/* Shrinks in place rather than sliding away. Everything floating above
          it reads the same scale, so the pair stays aligned at either size. */}
      <motion.div
        animate={{ scale: isVisible ? 1 : MOBILE_NAV_SHRUNKEN_SCALE }}
        className="fixed inset-x-0 z-[60] px-4 [view-transition-class:app-bar] [view-transition-name:app-mobile-nav] md:hidden"
        initial={false}
        style={{
          bottom: "max(calc(env(safe-area-inset-bottom) - 0.2rem), 1rem)",
          originY: 1,
        }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
      >
        <div className="flex items-center justify-center gap-3">
          {/* Nav items - icon height, full width */}
          <div className={`flex h-12 flex-1 items-center px-3 ${barSurfaceClassName}`}>
            <div className="relative w-full">
              {/* One pill slides between the tab columns, on a CSS `translate` transition. */}
              <span
                aria-hidden
                className={`pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center transition-[translate,opacity] duration-300 ease-(--vt-ease) motion-reduce:transition-none ${
                  activeTab < 0 ? "opacity-0" : ""
                }`}
                style={{
                  width: `${100 / NAV_TABS.length}%`,
                  translate: `${Math.max(activeTab, 0) * 100}% 0`,
                }}
              >
                <span className="bg-accent h-10 w-15 rounded-full" />
              </span>
              <ul
                className="relative grid w-full items-center justify-items-center"
                style={{ gridTemplateColumns: `repeat(${NAV_TABS.length}, minmax(0, 1fr))` }}
              >
                {NAV_TABS.map((href, position) => {
                  const Icon = TAB_ICONS[href] ?? HomeIcon;
                  const label =
                    href === SETTINGS_HREF
                      ? tMenu("settings.title")
                      : tNav(NAV_LABEL_KEYS[href] ?? "home");

                  return (
                    <li key={href}>
                      <NavTabLink
                        aria-label={label}
                        className={`${tabClassName} transition-colors ${
                          position === activeTab ? "text-accent-foreground" : idleTabClassName
                        }`}
                        href={href}
                        pathname={pathname}
                        title={label}
                        onClick={(e) => {
                          if (href === "/" && pathname === "/") {
                            e.preventDefault();
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </NavTabLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* User menu - its own circle beside the bar, and the disc the
              calendar's back-to-today button stacks on. */}
          <div
            className={`flex shrink-0 items-center justify-center ${cssFloatingDockEndCap} ${barSurfaceClassName}`}
          >
            <NavbarUserMenu isOpen={userMenuOpen} size="sm" onOpenChange={setUserMenuOpen} />
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default MobileNav;
