"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import MobileNav from "@/components/navbar/mobile-nav";
import NavbarUserMenu from "@/components/navbar/navbar-user-menu";
import { useAutoHide } from "@/hooks/auto-hide";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import { siteConfig } from "@norish/web/config/site";

// Map hrefs to translation keys
const navLabelKeys: Record<string, "home" | "calendar" | "groceries"> = {
  "/": "home",
  "/groceries": "groceries",
  "/calendar": "calendar",
};

export const Navbar = () => {
  const t = useTranslations("navbar.nav");
  const pathname = usePathname();
  const { isVisible, onHoverStart, onHoverEnd } = useAutoHide({
    idleDelay: Infinity, // Only hide on scroll, not on idle
  });

  return (
    <>
      {/* Spacer since navbar is fixed */}
      <div className="hidden md:block" style={{ height: "100px" }} />

      {/* Desktop navbar */}
      <motion.div
        animate={{
          y: isVisible ? 0 : -100,
          opacity: isVisible ? 1 : 0,
        }}
        className="fixed top-4 left-1/2 z-[60] hidden w-full max-w-7xl -translate-x-1/2 px-4 md:block"
        initial={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        onMouseEnter={onHoverStart}
        onMouseLeave={onHoverEnd}
      >
        <nav
          className="bg-surface mx-auto flex h-16 w-full items-center justify-between gap-4 rounded-[40px] px-4 shadow-[0_8px_28px_-10px_rgba(0,0,0,0.3)] transition-all"
          aria-label="Main navigation"
        >
          {/* Left */}
          <div className="flex min-w-0 items-center justify-start">
            <div className="max-w-fit">
              <NextLink
                aria-label="Go to home"
                className="flex items-center"
                href="/"
                onClick={(e) => {
                  if (pathname === "/") {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
              >
                <BrandLogo priority height={30} width={120} />
              </NextLink>
            </div>
          </div>

          {/* Center */}
          <div className="flex min-w-0 flex-1 justify-center">
            <ul className="ml-2 flex justify-start gap-3">
              {siteConfig.navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname?.startsWith(item.href + "/"));

                return (
                  <li key={item.href}>
                    <NextLink
                      className={`hover:text-accent rounded-md px-3 py-1.5 font-medium transition-colors ${
                        isActive ? "text-accent font-semibold" : "text-foreground/80"
                      }`}
                      href={item.href}
                    >
                      {t(navLabelKeys[item.href] ?? "home")}
                    </NextLink>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right */}
          <div className="flex items-center justify-end">
            <NavbarUserMenu />
          </div>
        </nav>
      </motion.div>

      {/* Mobile navbar */}
      <MobileNav />
    </>
  );
};

export default Navbar;
