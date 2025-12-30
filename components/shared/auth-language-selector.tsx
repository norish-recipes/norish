"use client";

import { FC, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { GlobeAltIcon } from "@heroicons/react/16/solid";

import {
  locales,
  localeNames,
  localeToCountry,
  LOCALE_COOKIE_NAME,
  type Locale,
} from "@/i18n/config";

// Dynamically import flag icons to avoid SSR issues
let FlagComponents: Record<string, FC<{ title: string; className?: string }>> = {};

/**
 * Language selector for auth pages (unauthenticated users)
 * Saves locale preference to cookie only
 */
export const AuthLanguageSelector: FC = () => {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [currentLocale, setCurrentLocale] = useState<Locale>("en");

  useEffect(() => {
    setMounted(true);
    // Dynamically import flags
    import("country-flag-icons/react/3x2").then((flags) => {
      FlagComponents = flags as unknown as Record<
        string,
        FC<{ title: string; className?: string }>
      >;
    });

    // Read current locale from cookie
    const cookies = document.cookie.split(";");
    const localeCookie = cookies.find((c) => c.trim().startsWith(`${LOCALE_COOKIE_NAME}=`));
    if (localeCookie) {
      const value = localeCookie.split("=")[1] as Locale;
      if (locales.includes(value)) {
        setCurrentLocale(value);
      }
    }
  }, []);

  const handleLocaleChange = (locale: Locale) => {
    // Set cookie
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setCurrentLocale(locale);

    // Refresh page to apply new locale
    startTransition(() => {
      router.refresh();
    });
  };

  if (!mounted) {
    return (
      <Button isIconOnly aria-label="Select language" size="sm" variant="light">
        <GlobeAltIcon className="size-5 opacity-50" />
      </Button>
    );
  }

  const CurrentFlag = FlagComponents[localeToCountry[currentLocale]];

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          isIconOnly
          aria-label="Select language"
          isLoading={isPending}
          size="sm"
          variant="light"
        >
          {CurrentFlag ? (
            <CurrentFlag className="h-4 w-5 rounded-sm" title={localeNames[currentLocale]} />
          ) : (
            <GlobeAltIcon className="size-5" />
          )}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Select language"
        selectedKeys={[currentLocale]}
        selectionMode="single"
        onSelectionChange={(keys) => {
          const selected = Array.from(keys)[0] as Locale;
          if (selected && selected !== currentLocale) {
            handleLocaleChange(selected);
          }
        }}
      >
        {locales.map((locale) => {
          const Flag = FlagComponents[localeToCountry[locale]];
          return (
            <DropdownItem
              key={locale}
              startContent={
                Flag ? (
                  <Flag className="h-3 w-4 rounded-sm" title={localeNames[locale]} />
                ) : (
                  <GlobeAltIcon className="size-4" />
                )
              }
            >
              {localeNames[locale]}
            </DropdownItem>
          );
        })}
      </DropdownMenu>
    </Dropdown>
  );
};

export default AuthLanguageSelector;
