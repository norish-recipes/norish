"use client";

import type { FC, ReactNode } from "react";
import { Suspense, use } from "react";
import { useLanguageSwitch } from "@/hooks/user/use-language-switch";
import { GlobeAltIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";
import { browser } from "react-dom";

type LanguageSwitchContentProps = {
  icon: ReactNode;
  isChanging: boolean;
  label: string;
};

/** What the server renders: the language list arrives in the browser. */
function LanguageSwitchPlaceholder() {
  const t = useTranslations("common.language");
  const tStatus = useTranslations("common.status");

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

function LanguageSwitchLabel({ icon, label, isChanging }: LanguageSwitchContentProps) {
  use(browser("The language list is read in the browser"));
  const t = useTranslations("common.language");
  const tStatus = useTranslations("common.status");

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
}

export const LanguageSwitchContent: FC<LanguageSwitchContentProps> = (props) => (
  <Suspense fallback={<LanguageSwitchPlaceholder />}>
    <LanguageSwitchLabel {...props} />
  </Suspense>
);

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
