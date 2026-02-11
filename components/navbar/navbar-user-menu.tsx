"use client";

import React, { useEffect, useState } from "react";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/react";
import {
  ArrowDownTrayIcon,
  ArrowLeftStartOnRectangleIcon,
  PlusIcon,
  EllipsisVerticalIcon,
  Cog6ToothIcon,
} from "@heroicons/react/16/solid";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { ThemeSwitch } from "./theme-switch";

import ImportRecipeModal from "@/components/shared/import-recipe-modal";
import { LanguageSwitch } from "@/components/shared/language-switch";
import { cssButtonPill, cssButtonPillDanger } from "@/config/css-tokens";
import { useUserContext } from "@/context/user-context";
import { useVersionQuery } from "@/hooks/config";

type TriggerVariant = "avatar" | "ellipsis";

interface NavbarUserMenuProps {
  trigger?: TriggerVariant;
}

function withQueryParams(url: string, params: Record<string, string | number>) {
  const [path, hash = ""] = url.split("#");
  const separator = path.includes("?") ? "&" : "?";
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

  return `${path}${separator}${query}${hash ? `#${hash}` : ""}`;
}

export default function NavbarUserMenu({ trigger = "avatar" }: NavbarUserMenuProps) {
  const t = useTranslations("navbar.userMenu");
  const { user, userMenuOpen: _userMenuOpen, setUserMenuOpen, signOut } = useUserContext();
  const router = useRouter();
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(() => Date.now());
  const { currentVersion, latestVersion, updateAvailable, releaseUrl } = useVersionQuery();

  useEffect(() => {
    if (user) {
      setImageError(false);
      setRetryCount(0);
      setAvatarRefreshKey(Date.now());
    }
  }, [user]);

  const handleImageError = () => {
    if (retryCount < 2) {
      // Retry up to 2 times with a small delay
      setTimeout(() => {
        setRetryCount((prev) => prev + 1);
      }, 1000);
    } else {
      // After retries, show fallback
      setImageError(true);
    }
  };

  if (!user) return null;

  return (
    <>
      <Dropdown placement="bottom-end" onOpenChange={setUserMenuOpen}>
        <DropdownTrigger>
          {trigger === "avatar" ? (
            <button aria-label="Open user menu" className="relative rounded-full" type="button">
              <Avatar
                className="isBordered h-13 w-13 cursor-pointer text-lg"
                color="warning"
                imgProps={{
                  onError: handleImageError,
                }}
                name={user?.name || user?.email || "U"}
                src={
                  !imageError && user?.image
                    ? withQueryParams(user.image, { retry: retryCount, v: avatarRefreshKey })
                    : undefined
                }
              />
              {updateAvailable && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                  <span className="bg-primary relative inline-flex h-3 w-3 rounded-full" />
                </span>
              )}
            </button>
          ) : (
            <Button
              isIconOnly
              className="bg-default-100 text-foreground"
              radius="full"
              size="sm"
              variant="flat"
            >
              <EllipsisVerticalIcon className="size-5" />
            </Button>
          )}
        </DropdownTrigger>

        <DropdownMenu aria-label="User menu" className="min-w-[260px]">
          {user && (
            <DropdownItem
              key="user"
              isReadOnly
              className="flex cursor-default flex-col items-start gap-1 data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent"
            >
              <span className="text-sm font-semibold">{user.name}</span>
              <span className="text-default-500 text-xs"> ({user.email})</span>
            </DropdownItem>
          )}

          <DropdownItem key="language" isReadOnly className={`py-3 ${cssButtonPill}`}>
            <LanguageSwitch />
          </DropdownItem>

          <DropdownItem
            key="create-recipe"
            className={`py-3 ${cssButtonPill}`}
            startContent={
              <span className="text-default-500">
                <PlusIcon className="size-5" />
              </span>
            }
            onPress={() => {
              setUserMenuOpen(false);
              router.push("/recipes/new");
            }}
          >
            <div className="flex flex-col items-start">
              <span className="text-base leading-tight font-medium">{t("newRecipe.title")}</span>
              <span className="text-default-500 text-xs leading-tight">
                {t("newRecipe.description")}
              </span>
            </div>
          </DropdownItem>

          <DropdownItem
            key="import-url"
            className={`py-3 ${cssButtonPill}`}
            startContent={
              <span className="text-default-500">
                <ArrowDownTrayIcon className="size-5" />
              </span>
            }
            onPress={() => {
              setUserMenuOpen(false);
              setShowUrlModal(true);
            }}
          >
            <div className="flex flex-col items-start">
              <span className="text-base leading-tight font-medium">{t("importUrl.title")}</span>
              <span className="text-default-500 text-xs leading-tight">
                {t("importUrl.description")}
              </span>
            </div>
          </DropdownItem>

          <DropdownItem key="theme" isReadOnly className={`py-3 ${cssButtonPill}`}>
            <ThemeSwitch />
          </DropdownItem>
          <DropdownItem
            key="settings"
            className={`py-3 ${cssButtonPill}`}
            href="/settings?tab=user"
            startContent={
              <span className="text-default-500">
                <Cog6ToothIcon className="size-5" />
              </span>
            }
            onPress={() => setUserMenuOpen(false)}
          >
            <div className="flex flex-col items-start">
              <span className="text-base leading-tight font-medium">{t("settings.title")}</span>
              <span className="text-default-500 text-xs leading-tight">
                {t("settings.description")}
              </span>
            </div>
          </DropdownItem>

          <DropdownItem
            key="logout"
            className={`text-danger-400 py-3 ${cssButtonPillDanger}`}
            startContent={
              <span className="text-danger-400">
                <ArrowLeftStartOnRectangleIcon className="size-5" />
              </span>
            }
            onPress={() => {
              setUserMenuOpen(false);
              signOut();
            }}
          >
            <span className="text-base font-medium">{t("logout")}</span>
          </DropdownItem>

          {/* Version info - discrete footer */}
          <DropdownItem
            key="version"
            className="border-default-100 cursor-default border-t pt-2 data-[hover=true]:bg-transparent"
            isReadOnly={!updateAvailable}
            textValue="Version"
          >
            <div className="text-default-400 flex items-center justify-end gap-2 text-xs">
              {updateAvailable && releaseUrl && latestVersion && (
                <a
                  className="text-primary hover:text-primary-600 hover:underline"
                  href={releaseUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t("version.updateAvailable", { version: latestVersion })}
                </a>
              )}
              <span>v{currentVersion ?? "..."}</span>
            </div>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      {/* Import from URL Modal */}
      <ImportRecipeModal isOpen={showUrlModal} onOpenChange={setShowUrlModal} />
    </>
  );
}
