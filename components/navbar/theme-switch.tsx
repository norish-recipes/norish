"use client";

import { FC, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MoonIcon, SunIcon, ComputerDesktopIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

// Hook to get theme state and toggle function
export function useThemeSwitch() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveTheme = resolvedTheme ?? theme;
  const isDark = effectiveTheme === "dark";

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const icon =
    theme === "system" ? (
      <ComputerDesktopIcon className="size-4" />
    ) : isDark ? (
      <MoonIcon className="size-4" />
    ) : (
      <SunIcon className="size-4" />
    );

  // Return raw theme for label lookup
  return { mounted, icon, theme, isDark, cycleTheme };
}

// Renders the content for inside the DropdownItem - includes icon for proper alignment
export const ThemeSwitch: FC = () => {
  const t = useTranslations("navbar.theme");
  const { mounted, icon, theme, isDark, cycleTheme } = useThemeSwitch();

  const label = theme === "system" ? t("system") : isDark ? t("dark") : t("light");

  if (!mounted) {
    return (
      <div className="flex w-full cursor-pointer items-center gap-2" role="button" tabIndex={0}>
        <span className="text-default-500 opacity-50">
          <SunIcon className="size-4" />
        </span>
        <div className="flex flex-col items-start opacity-50">
          <span className="text-base leading-tight font-medium">{t("title")}</span>
          <span className="text-default-500 text-xs leading-tight">{t("loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex w-full cursor-pointer items-center gap-2"
      role="button"
      tabIndex={0}
      onClick={cycleTheme}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          cycleTheme();
        }
      }}
    >
      <span className="text-default-500">{icon}</span>
      <div className="flex flex-col items-start">
        <span className="text-base leading-tight font-medium">{t("title")}</span>
        <span className="text-default-500 text-xs leading-tight">{label}</span>
      </div>
    </div>
  );
};
