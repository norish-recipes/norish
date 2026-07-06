"use client";

import type { FC, ReactNode } from "react";
import { useLanguageSwitch } from "@/hooks/user/use-language-switch";
import { GlobeAltIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

type LanguageSwitchContentProps = {
  icon: ReactNode;
  isChanging: boolean;
  label: string;
  mounted: boolean;
};

export const LanguageSwitchContent: FC<LanguageSwitchContentProps> = ({
  mounted,
  icon,
  label,
  isChanging,
}) => {
  const t = useTranslations("common.language");
  const tStatus = useTranslations("common.status");

  if (!mounted) {
    return (
      <div className="flex w-full items-center gap-2">
        <span className="text-muted opacity-50">
          <GlobeAltIcon className="size-4" />
        </span>
        <div className="flex flex-col items-start opacity-50">
          <span className="text-base leading-tight font-medium">{t("title")}</span>
          <span className="text-muted text-xs leading-tight">{tStatus("loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-center gap-2">
      <span className="text-muted">{icon}</span>
      <div className="flex flex-col items-start">
        <span className="text-base leading-tight font-medium">{t("title")}</span>
        <span className="text-muted text-xs leading-tight">
          {isChanging ? tStatus("changing") : label}
        </span>
      </div>
    </div>
  );
};

/**
 * Language switch component for use outside menu item action hosts.
 *
 * Used by authenticated users only - saves preference to database.
 */
export const LanguageSwitch: FC = () => {
  const languageSwitch = useLanguageSwitch();

  return (
    <button
      className="flex w-full cursor-pointer items-center gap-2 text-left"
      type="button"
      onClick={languageSwitch.cycleLocale}
    >
      <LanguageSwitchContent {...languageSwitch} />
    </button>
  );
};

export default LanguageSwitch;
