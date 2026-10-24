"use client";

import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand/brand-logo";
import MobileNav from "@/components/navbar/mobile-nav";
import { NAV_LABEL_KEYS, NavTabLink, navTabPosition } from "@/components/navbar/nav-tabs";
import NavbarUserMenu from "@/components/navbar/navbar-user-menu";
import { useAutoHide } from "@/hooks/auto-hide";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import { siteConfig } from "@norish/web/config/site";

export const Navbar = () => {
  const t = useTranslations("navbar.nav");
  const pathname = usePathname();
  const activeTab = navTabPosition(pathname);
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
        className="fixed top-4 left-1/2 z-[60] hidden w-full max-w-7xl -translate-x-1/2 px-4 [view-transition-class:app-bar] [view-transition-name:app-navbar] md:block"
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
              {/* On sign-in, globals.css moves the auth page's logo (`brand-logo`) onto this one. */}
              <NavTabLink
                data-brand-logo
                aria-label="Go to home"
                className="flex items-center"
                href="/"
                pathname={pathname}
                onClick={(e) => {
                  if (pathname === "/") {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
              >
                <BrandLogo priority height={30} width={120} />
              </NavTabLink>
            </div>
          </div>

          {/* Center */}
          <div className="flex min-w-0 flex-1 justify-center">
            <ul className="ml-2 flex justify-start gap-3">
              {/* The nav items lead NAV_TABS, so each one's position is its tab's. */}
              {siteConfig.navItems.map((item, position) => (
                <li key={item.href}>
                  <NavTabLink
                    className={`hover:text-accent rounded-md px-3 py-1.5 font-medium transition-colors ${
                      position === activeTab ? "text-accent font-semibold" : "text-foreground/80"
                    }`}
                    href={item.href}
                    pathname={pathname}
                  >
                    {t(NAV_LABEL_KEYS[item.href] ?? "home")}
                  </NavTabLink>
                </li>
              ))}
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
