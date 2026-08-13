"use client";

import { useCallback, useEffect, useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import NavbarUserMenu from "@/components/navbar/navbar-user-menu";
import { useAutoHide } from "@/hooks/auto-hide";
import { CalendarDaysIcon, ClipboardDocumentListIcon, HomeIcon } from "@heroicons/react/20/solid";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import { siteConfig } from "@norish/web/config/site";

// Map hrefs to translation keys (same as navbar.tsx)
const navLabelKeys: Record<string, "home" | "calendar" | "groceries"> = {
  "/": "home",
  "/groceries": "groceries",
  "/calendar": "calendar",
};

export const MobileNav = () => {
  const tNav = useTranslations("navbar.nav");
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
        animate={{
          y: isVisible ? 0 : 100,
          opacity: isVisible ? 1 : 0,
        }}
        className="fixed inset-x-0 z-[60] px-4 md:hidden"
        initial={false}
        style={{ bottom: "max(calc(env(safe-area-inset-bottom) - 0.2rem), 1rem)" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {/* One solid object: nav items and the account avatar share the bar (ADR-0020) */}
        <div className="border-border bg-surface flex h-13 items-center rounded-full border px-3 shadow-[0_8px_28px_-10px_rgba(0,0,0,0.3)]">
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
                    className={`flex flex-col items-center justify-center gap-1 rounded-full px-4 py-1.5 transition-colors ${
                      isActive
                        ? "bg-accent-soft text-accent font-semibold"
                        : "text-muted hover:text-foreground hover:bg-surface-secondary"
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
                    <span className="leading-none">{tNav(navLabelKeys[item.href] ?? "home")}</span>
                  </NextLink>
                </li>
              );
            })}

            <li className="flex items-center justify-center">
              <NavbarUserMenu
                isOpen={userMenuOpen}
                size="sm"
                onOpenChange={setUserMenuOpen}
              />
            </li>
          </ul>
        </div>
      </motion.div>
    </>
  );
};

export default MobileNav;
