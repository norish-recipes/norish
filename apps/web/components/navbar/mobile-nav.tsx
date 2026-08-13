"use client";

import { useCallback, useEffect, useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
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

import { siteConfig } from "@norish/web/config/site";

// Map hrefs to translation keys (same as navbar.tsx)
const navLabelKeys: Record<string, "home" | "calendar" | "groceries"> = {
  "/": "home",
  "/groceries": "groceries",
  "/calendar": "calendar",
};

// Both floating pieces share one solid treatment on the chrome tokens — the
// opposite theme's ground — so the bar contrasts with the cards scrolling
// under it (ADR-0020).
const barSurfaceClassName =
  "bg-chrome border-chrome-border rounded-full border shadow-[0_8px_28px_-10px_rgba(0,0,0,0.3)]";

export const MobileNav = () => {
  const tNav = useTranslations("navbar.nav");
  const tMenu = useTranslations("navbar.userMenu");
  const pathname = usePathname();
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

      <motion.div
        animate={{ scale: isVisible ? 1 : 0.8 }}
        className="fixed inset-x-0 z-[60] px-4 md:hidden"
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
            <ul className="flex w-full items-center justify-around">
              {siteConfig.navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname?.startsWith(item.href + "/"));
                const Icon =
                  item.href === "/"
                    ? HomeIcon
                    : item.href.startsWith("/calendar")
                      ? CalendarDaysIcon
                      : ClipboardDocumentListIcon;
                const label = tNav(navLabelKeys[item.href] ?? "home");

                return (
                  <li key={item.href}>
                    <NextLink
                      aria-label={label}
                      className={`flex items-center justify-center rounded-full p-2.5 transition-colors ${
                        isActive
                          ? "bg-accent-soft text-accent"
                          : "text-chrome-muted hover:text-chrome-foreground hover:bg-chrome-hover"
                      }`}
                      href={item.href}
                      title={label}
                      onClick={(e) => {
                        if (item.href === "/" && pathname === "/") {
                          e.preventDefault();
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </NextLink>
                  </li>
                );
              })}

              <li>
                <NextLink
                  aria-label={tMenu("settings.title")}
                  className={`flex items-center justify-center rounded-full p-2.5 transition-colors ${
                    pathname?.startsWith("/settings")
                      ? "bg-accent-soft text-accent"
                      : "text-chrome-muted hover:text-chrome-foreground hover:bg-chrome-hover"
                  }`}
                  href="/settings?tab=user"
                  title={tMenu("settings.title")}
                >
                  <Cog6ToothIcon className="h-5 w-5" />
                </NextLink>
              </li>
            </ul>
          </div>

          {/* User menu - its own circle beside the bar */}
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center ${barSurfaceClassName}`}
          >
            <NavbarUserMenu isOpen={userMenuOpen} size="sm" onOpenChange={setUserMenuOpen} />
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default MobileNav;
