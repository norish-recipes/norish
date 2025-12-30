"use client";

import { GlobeAltIcon } from "@heroicons/react/16/solid";
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useLocaleCookie } from "@/hooks/user/use-locale-cookie";
import { locales, localeNames, type Locale } from "@/i18n/config";

/**
 * Language selector for auth pages (login/signup)
 *
 * Uses cookie-based locale storage since user is not authenticated.
 */
export function AuthLanguageSelector() {
  const t = useTranslations("common.language");
  const { locale, changeLocale, isChanging } = useLocaleCookie();

  return (
    <Dropdown placement="bottom">
      <DropdownTrigger>
        <Button
          isIconOnly
          aria-label={t("title")}
          isLoading={isChanging}
          radius="full"
          size="sm"
          variant="light"
        >
          <GlobeAltIcon className="size-5" />
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={t("title")}
        selectedKeys={[locale]}
        selectionMode="single"
        onSelectionChange={(keys) => {
          const selected = Array.from(keys)[0] as Locale;
          if (selected) {
            changeLocale(selected);
          }
        }}
      >
        {locales.map((loc) => (
          <DropdownItem key={loc}>{localeNames[loc]}</DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

export default AuthLanguageSelector;
