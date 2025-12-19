"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useCallback, useTransition, useMemo } from "react";
import { motion } from "motion/react";
import {
  HomeIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  ArrowLeftIcon,
} from "@heroicons/react/20/solid";
import { Button, Input } from "@heroui/react";

import Filters from "../shared/filters";

import { isUrl } from "@/lib/helpers";
import TagCarousel from "@/components/shared/tag-carousel";
import NavbarUserMenu from "@/components/navbar/navbar-user-menu";
import { useAppStore } from "@/store/useAppStore";
import { useRecipesContext } from "@/context/recipes-context";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { cssGlassBackdrop, cssInputNoHoverTransparent } from "@/config/css-tokens";
import { siteConfig } from "@/config/site";
import { useAutoHide } from "@/hooks/auto-hide";
import { useUserContext } from "@/context/user-context";

export const MobileNav = () => {
  const pathname = usePathname();
  const { mobileSearchOpen, setMobileSearchOpen } = useAppStore((s) => s);
  const { filters, setFilters } = useRecipesFiltersContext();
  const { importRecipe } = useRecipesContext();
  const { userMenuOpen } = useUserContext();
  const [_isPending, startTransition] = useTransition();

  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isHome = pathname === "/";

  const { isVisible, show } = useAutoHide({
    disabled: mobileSearchOpen || userMenuOpen,
  });

  // Keep visible while search or user menu is open
  useEffect(() => {
    if (mobileSearchOpen || userMenuOpen) {
      show();
    }
  }, [mobileSearchOpen, userMenuOpen, show]);

  useEffect(() => {
    if (!isVisible && mobileSearchOpen) {
      inputRef.current?.blur();
      setMobileSearchOpen(false);
    }
  }, [isVisible, mobileSearchOpen, setMobileSearchOpen]);

  // Close search when navigating away from home
  useEffect(() => {
    if (!isHome && mobileSearchOpen) {
      setMobileSearchOpen(false);
    }
  }, [isHome, mobileSearchOpen, setMobileSearchOpen]);

  // Focus search after viewport is locked
  useEffect(() => {
    if (isHome && mobileSearchOpen && inputRef.current) {
      const id = setTimeout(() => inputRef.current?.focus(), 10);

      return () => clearTimeout(id);
    }
  }, [mobileSearchOpen, isHome]);

  // Keyboard shortcut to open search (Cmd+K or /)
  useEffect(() => {
    if (!isHome) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setMobileSearchOpen(true);

        return;
      }
      // "/" key (only if not typing in an input)
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setMobileSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isHome, setMobileSearchOpen]);

  const closeSearch = useCallback(() => {
    setMobileSearchOpen(false);
    inputRef.current?.blur();
  }, [setMobileSearchOpen]);

  // Click outside search to close
  useEffect(() => {
    if (!isHome || !mobileSearchOpen) return;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;

      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (target.closest("[data-filter-menu]")) return;
      closeSearch();
    };

    document.addEventListener("pointerdown", onPointerDown, { capture: true });

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      } as any);
    };
  }, [mobileSearchOpen, closeSearch, isHome]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    startTransition(async () => {
      if (isUrl(value.trim())) {
        setFilters({ rawInput: "" });
        await importRecipe(value.trim());
      } else {
        setFilters({ rawInput: value });
      }
    });
  };

  const hasActiveSearch = useMemo(
    () => (filters.rawInput?.trim()?.length ?? 0) > 0 || filters.searchTags.length > 0,
    [filters.rawInput, filters.searchTags.length]
  );

  return (
    <motion.div
      animate={{
        y: isVisible ? 0 : 100,
        opacity: isVisible ? 1 : 0,
      }}
      className="fixed inset-x-0 z-50 px-5 md:hidden"
      initial={{ y: 0, opacity: 1 }}
      style={{ bottom: "max(calc(env(safe-area-inset-bottom) - 0.2rem), 1rem)" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      <div ref={rootRef} className="relative flex items-center justify-between">
        {/* Left side */}
        {isHome ? (
          <div
            className={`relative min-w-0 flex-1 transition-all duration-300 ${
              mobileSearchOpen ? "z-[99] mr-3" : "z-[40] mr-0"
            }`}
          >
            {mobileSearchOpen && (
              <div className="pointer-events-auto absolute -top-10 right-0 left-0 z-[60] px-1 pb-1">
                <TagCarousel />
              </div>
            )}
            <div
              aria-expanded={mobileSearchOpen}
              className={`group relative h-13 overflow-visible rounded-full transition-[width] duration-300 ease-out ${cssGlassBackdrop} ${
                mobileSearchOpen ? "z-[55] w-full" : "z-[55] w-[52px]"
              }`}
            >
              <div className="absolute inset-y-0 left-0 z-[56] flex w-[52px] items-center justify-center">
                <Button
                  isIconOnly
                  aria-label="Toggle search"
                  className={`relative h-10 w-10 !bg-transparent !shadow-none ${
                    hasActiveSearch ? "text-primary" : "text-default-600 hover:text-foreground"
                  }`}
                  radius="full"
                  size="md"
                  variant="light"
                  onPress={() => {
                    setMobileSearchOpen(!mobileSearchOpen);
                  }}
                >
                  <MagnifyingGlassIcon className="h-5 w-5" />
                  {hasActiveSearch && (
                    <span className="bg-primary shadow-background absolute top-2 right-2 h-2.5 w-2.5 rounded-full shadow-[0_0_0_2px]" />
                  )}
                </Button>
              </div>
              <div
                className={`flex h-full items-center pl-[52px] transition-all duration-300 ease-out ${
                  mobileSearchOpen ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
              >
                <Input
                  ref={inputRef}
                  isClearable
                  className="w-full"
                  classNames={{
                    inputWrapper: `!bg-transparent h-13 px-3 ${cssInputNoHoverTransparent}`,
                    input: "text-[15px] placeholder:text-default-500 !bg-transparent",
                  }}
                  id="mobile-search-input"
                  placeholder="Search recipes..."
                  radius="full"
                  style={{ fontSize: "16px" }}
                  value={filters.rawInput}
                  variant="flat"
                  onChange={handleSearchChange}
                  onClear={() => setFilters({ rawInput: "" })}
                  onKeyDown={(e) => e.key === "Escape" && closeSearch()}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mr-2 shrink-0">
            <Button
              isIconOnly
              aria-label="Go back"
              className={`h-13 w-13 ${cssGlassBackdrop} text-default-600 hover:text-foreground hover:bg-default-100/70`}
              radius="full"
              size="md"
              variant="flat"
              onPress={() => {
                if (typeof window !== "undefined") {
                  if (window.history.length > 1) window.history.back();
                  else window.location.href = "/";
                }
              }}
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Center */}
        <div className="absolute left-1/2 z-[45] -translate-x-1/2">
          <div
            className={`flex h-13 items-center gap-2 rounded-full px-4 ${cssGlassBackdrop} transition-all duration-300 ease-out ${
              isHome && mobileSearchOpen
                ? "pointer-events-none translate-y-4 opacity-0"
                : "translate-y-0 opacity-100"
            }`}
          >
            <ul className="flex items-center gap-2 text-[11px]">
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
                      className={`flex w-[60px] flex-col items-center justify-center gap-1 rounded-full px-3 py-2 transition-colors ${
                        isActive
                          ? "text-primary font-semibold"
                          : "text-default-600 hover:text-foreground hover:bg-default-100/70"
                      }`}
                      href={item.href}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="leading-none">{item.label}</span>
                    </NextLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Right side */}
        <div className="flex h-13 shrink-0 items-center justify-center">
          <div className="relative flex h-13 w-[60px] items-center justify-center">
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                mobileSearchOpen ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <Filters isGlass />
            </div>
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                mobileSearchOpen ? "pointer-events-none opacity-0" : "opacity-100"
              }`}
            >
              <NavbarUserMenu />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MobileNav;
