"use client";

import { FC } from "react";
import { GlobeAltIcon } from "@heroicons/react/16/solid";

import { useLanguageSwitch } from "@/hooks/user/use-language-switch";

interface LanguageSwitchProps {
  /** Whether user is authenticated (determines storage method) */
  isAuthenticated?: boolean;
}

/**
 * Language switch component for use in dropdown menus
 * Cycles through available locales on click
 */
export const LanguageSwitch: FC<LanguageSwitchProps> = ({ isAuthenticated = true }) => {
  const { mounted, icon, label, cycleLocale, isChanging } = useLanguageSwitch(isAuthenticated);

  if (!mounted) {
    return (
      <div className="flex w-full cursor-pointer items-center gap-2" role="button" tabIndex={0}>
        <span className="text-default-500 opacity-50">
          <GlobeAltIcon className="size-4" />
        </span>
        <div className="flex flex-col items-start opacity-50">
          <span className="text-base leading-tight font-medium">Language</span>
          <span className="text-default-500 text-xs leading-tight">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex w-full cursor-pointer items-center gap-2"
      role="button"
      tabIndex={0}
      onClick={cycleLocale}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          cycleLocale();
        }
      }}
    >
      <span className="text-default-500">{icon}</span>
      <div className="flex flex-col items-start">
        <span className="text-base leading-tight font-medium">Language</span>
        <span className="text-default-500 text-xs leading-tight">
          {isChanging ? "Changing…" : label}
        </span>
      </div>
    </div>
  );
};

export default LanguageSwitch;
