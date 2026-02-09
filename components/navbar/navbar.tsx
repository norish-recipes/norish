"use client";

import { Navbar as HeroUINavbar, NavbarContent, NavbarBrand, NavbarItem } from "@heroui/navbar";
import NextLink from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import { siteConfig } from "@/config/site";
import NavbarUserMenu from "@/components/navbar/navbar-user-menu";
import MobileNav from "@/components/navbar/mobile-nav";
import logo from "@/public/norish-logo.png";
import { useAutoHide } from "@/hooks/auto-hide";

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
        <HeroUINavbar
          className="bg-content1 rounded-[40px] shadow-[0_8px_28px_-10px_rgba(0,0,0,0.3)] transition-all"
          isBordered={false}
          maxWidth="xl"
          position="static"
        >
          {/* Left */}
          <NavbarContent justify="start">
            <NavbarBrand className="max-w-fit gap-3">
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
                <Image priority alt="Norish logo" height={30} src={logo} width={120} />
              </NextLink>
            </NavbarBrand>
          </NavbarContent>

          {/* Center */}
          <NavbarContent justify="center">
            <ul className="ml-2 flex justify-start gap-3">
              {siteConfig.navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname?.startsWith(item.href + "/"));

                return (
                  <NavbarItem key={item.href}>
                    <NextLink
                      className={`hover:text-primary rounded-md px-3 py-1.5 font-medium transition-colors ${
                        isActive ? "text-primary font-semibold" : "text-foreground/80"
                      }`}
                      href={item.href}
                    >
                      {t(navLabelKeys[item.href] ?? "home")}
                    </NextLink>
                  </NavbarItem>
                );
              })}
            </ul>
          </NavbarContent>

          {/* Right */}
          <NavbarContent className="items-center" justify="end">
            <NavbarItem className="flex items-center">
              <NavbarUserMenu />
            </NavbarItem>
          </NavbarContent>
        </HeroUINavbar>
      </motion.div>

      {/* Mobile navbar */}
      <MobileNav />
    </>
  );
};

export default Navbar;
