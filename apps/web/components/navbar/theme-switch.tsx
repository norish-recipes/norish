"use client";

import type { FC, ReactNode } from "react";
import { Suspense, use } from "react";
import { ComputerDesktopIcon, MoonIcon, SunIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { browser } from "react-dom";

export function useThemeSwitch() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const effectiveTheme = resolvedTheme ?? theme;
  const isDark = effectiveTheme === "dark";

  const cycleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

    setTheme(nextTheme);
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
  return { icon, theme, isDark, cycleTheme };
}

type ThemeSwitchContentProps = {
  icon: ReactNode;
  isDark: boolean;
  theme: string | undefined;
};

/** What the server renders: the reader's theme is known in the browser only. */
function ThemeSwitchPlaceholder() {
  const t = useTranslations("navbar.theme");

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

function ThemeSwitchLabel({ icon, theme, isDark }: ThemeSwitchContentProps) {
  use(browser("The theme is read from the browser"));
  const t = useTranslations("navbar.theme");

  const label =
    theme === "system" ? t("system") : theme === "dark" || isDark ? t("dark") : t("light");

  return (
    <div className="flex w-full items-center gap-2">
      <span className="text-muted">{icon}</span>
      <div className="flex flex-col items-start">
        <span className="text-base leading-tight font-medium">{t("title")}</span>
        <span className="text-muted text-xs leading-tight">{label}</span>
      </div>
    </div>
  );
}

export const ThemeSwitchContent: FC<ThemeSwitchContentProps> = (props) => (
  <Suspense fallback={<ThemeSwitchPlaceholder />}>
    <ThemeSwitchLabel {...props} />
  </Suspense>
);

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
