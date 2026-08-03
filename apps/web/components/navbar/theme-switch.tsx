"use client";

import type { FC, ReactNode } from "react";
import { useEffect, useState } from "react";
import { ComputerDesktopIcon, MoonIcon, SunIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

export function useThemeSwitch() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveTheme = resolvedTheme ?? theme;
  const isDark = effectiveTheme === "dark";

  const cycleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

    setTheme(nextTheme);
  };

  const icon =
    !mounted || theme === "system" ? (
      <ComputerDesktopIcon className="size-4" />
    ) : isDark ? (
      <MoonIcon className="size-4" />
    ) : (
      <SunIcon className="size-4" />
    );

  // Return raw theme for label lookup
  return { mounted, icon, theme, isDark, cycleTheme };
}

type ThemeSwitchContentProps = {
  icon: ReactNode;
  isDark: boolean;
  mounted: boolean;
  theme: string | undefined;
};

export const ThemeSwitchContent: FC<ThemeSwitchContentProps> = ({
  mounted,
  icon,
  theme,
  isDark,
}) => {
  const t = useTranslations("navbar.theme");

  const label = theme === "system" ? t("system") : theme === "dark" || isDark ? t("dark") : t("light");

  if (!mounted) {
    return (
      <div className="flex w-full items-center gap-2">
        <span className="text-muted opacity-50">
          <SunIcon className="size-4" />
        </span>
        <div className="flex flex-col items-start opacity-50">
          <span className="text-base leading-tight font-medium">{t("title")}</span>
          <span className="text-muted text-xs leading-tight">{t("loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center gap-2">
      <span className="text-muted">{icon}</span>
      <div className="flex flex-col items-start">
        <span className="text-base leading-tight font-medium">{t("title")}</span>
        <span className="text-muted text-xs leading-tight">{label}</span>
      </div>
    </div>
  );
};

export const ThemeSwitch: FC = () => {
  const themeSwitch = useThemeSwitch();

  return (
    <button
      className="flex w-full cursor-pointer items-center gap-2 text-left"
      type="button"
      onClick={themeSwitch.cycleTheme}
    >
      <ThemeSwitchContent {...themeSwitch} />
    </button>
  );
};
