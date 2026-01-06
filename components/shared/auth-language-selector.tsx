"use client";

import { GlobeAltIcon } from "@heroicons/react/16/solid";
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Skeleton,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import { useLocaleCookie } from "@/hooks/user/use-locale-cookie";
import { type Locale, isValidLocale } from "@/i18n/config";

/**
 * Language selector for auth pages (login/signup)
 *
 * Uses cookie-based locale storage since user is not authenticated.
 * Fetches enabled locales from the public API.
 */
export function AuthLanguageSelector() {
  const t = useTranslations("common.language");
  const { locale, changeLocale, isChanging, isLoadingConfig, enabledLocales } = useLocaleCookie();

  // Show skeleton while loading config
  if (isLoadingConfig) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  // Don't render if only one locale is enabled (no choice to make)
  if (enabledLocales.length <= 1) {
    return null;
  }

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
          const selected = Array.from(keys)[0] as string;

          if (selected && isValidLocale(selected)) {
            changeLocale(selected as Locale);
          }
        }}
      >
        {enabledLocales.map((loc) => (
          <DropdownItem key={loc.code}>{loc.name}</DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

export default AuthLanguageSelector;
