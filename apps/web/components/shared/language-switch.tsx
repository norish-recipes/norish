"use client";

import { FC } from "react";
import { GlobeAltIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useLanguageSwitch } from "@/hooks/user/use-language-switch";

/**
 * Language switch component for use in dropdown menus
 * Cycles through available locales on click
 *
 * Used by authenticated users only - saves preference to database.
 */
export const LanguageSwitch: FC = () => {
  const t = useTranslations("common.language");
  const tStatus = useTranslations("common.status");
  const { mounted, icon, label, cycleLocale, isChanging } = useLanguageSwitch();

  if (!mounted) {
    return (
      <div className="flex w-full cursor-pointer items-center gap-2" role="button" tabIndex={0}>
        <span className="text-default-500 opacity-50">
          <GlobeAltIcon className="size-4" />
        </span>
        <div className="flex flex-col items-start opacity-50">
          <span className="text-base leading-tight font-medium">{t("title")}</span>
          <span className="text-default-500 text-xs leading-tight">{tStatus("loading")}</span>
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
        <span className="text-base leading-tight font-medium">{t("title")}</span>
        <span className="text-default-500 text-xs leading-tight">
          {isChanging ? tStatus("changing") : label}
        </span>
      </div>
    </div>
  );
};

export default LanguageSwitch;
