"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HomeIcon, CalendarDaysIcon, ClipboardDocumentListIcon } from "@heroicons/react/20/solid";
import { useTranslations } from "next-intl";

import NavbarUserMenu from "@/components/navbar/navbar-user-menu";
import { cssGlassBackdrop } from "@/config/css-tokens";
import { siteConfig } from "@/config/site";
import { useAutoHide } from "@/hooks/auto-hide";
import { useUserContext } from "@/context/user-context";

// Map hrefs to translation keys (same as navbar.tsx)
const navLabelKeys: Record<string, "home" | "calendar" | "groceries"> = {
  "/": "home",
  "/groceries": "groceries",
  "/calendar": "calendar",
};

export const MobileNav = () => {
  const tNav = useTranslations("navbar.nav");
  const pathname = usePathname();
  const { userMenuOpen, setUserMenuOpen } = useUserContext();

  const rootRef = useRef<HTMLDivElement | null>(null);

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
        animate={{
          y: isVisible ? 0 : 100,
          opacity: isVisible ? 1 : 0,
        }}
        className="fixed inset-x-0 z-[60] px-4 md:hidden"
        initial={false}
        style={{ bottom: "max(calc(env(safe-area-inset-bottom) - 0.2rem), 1rem)" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <div ref={rootRef} className="flex items-center justify-center gap-3">
          {/* Nav items - full width */}
          <div
            className={`flex h-13 flex-1 items-center justify-center rounded-full px-4 ${cssGlassBackdrop}`}
          >
            <ul className="flex w-full items-center justify-around text-[11px]">
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

                return (
                  <li key={item.href}>
                    <NextLink
                      className={`flex flex-col items-center justify-center gap-1 rounded-full px-4 py-2 transition-colors ${
                        isActive
                          ? "text-primary font-semibold"
                          : "text-default-600 hover:text-foreground hover:bg-default-100/70"
                      }`}
                      href={item.href}
                      onClick={(e) => {
                        if (item.href === "/" && pathname === "/") {
                          e.preventDefault();
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="leading-none">
                        {tNav(navLabelKeys[item.href] ?? "home")}
                      </span>
                    </NextLink>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* User menu */}
          <div
            className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-full ${cssGlassBackdrop}`}
          >
            <NavbarUserMenu />
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default MobileNav;
