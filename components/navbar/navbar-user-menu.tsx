"use client";

import React, { useEffect, useState } from "react";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/react";
import {
  ArrowDownTrayIcon,
  ArrowUpIcon,
  PlusIcon,
} from "@heroicons/react/16/solid";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { UsersIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

import { ThemeSwitch } from "./theme-switch";

import ImportRecipeModal from "@/components/shared/import-recipe-modal";
import { cssButtonPill, cssButtonPillDanger } from "@/config/css-tokens";
import { useUserContext } from "@/context/user-context";

type TriggerVariant = "avatar" | "ellipsis";

interface NavbarUserMenuProps {
  trigger?: TriggerVariant;
}

export default function NavbarUserMenu({ trigger = "avatar" }: NavbarUserMenuProps) {
  const { user, userMenuOpen, setUserMenuOpen, signOut } = useUserContext();
  const router = useRouter();
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Reset image error and retry count when user changes
  useEffect(() => {
    setImageError(false);
    setRetryCount(0);
  }, [user?.image]);

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
            <button aria-label="Open user menu" className="rounded-full" type="button">
              <Avatar
                className="isBordered h-13 w-13 cursor-pointer text-lg"
                color="warning"
                imgProps={{
                  onError: handleImageError,
                }}
                name={user?.name || user?.email || "U"}
                src={!imageError && user?.image ? `${user.image}?retry=${retryCount}` : undefined}
              />
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

          <DropdownItem
            key="create-recipe"
            className="py-2 data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent"
            onPress={() => {
              setUserMenuOpen(false);
              router.push("/recipes/new");
            }}
          >
            <Button
              className={`w-full justify-start bg-transparent ${cssButtonPill}`}
              radius="full"
              size="md"
              startContent={
                <span className="text-default-500">
                  <PlusIcon className="size-4" />
                </span>
              }
              variant="light"
            >
              <span className="flex flex-col items-start">
                <span className="text-sm leading-tight font-medium">New recipe</span>
                <span className="text-default-500 text-xs leading-tight">Write your own recipe</span>
              </span>
            </Button>
          </DropdownItem>

          <DropdownItem
            key="import-url"
            className="py-2 data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent"
            onPress={() => {
              setUserMenuOpen(false);
              setShowUrlModal(true);
            }}
          >
            <Button
              className={`w-full justify-start bg-transparent ${cssButtonPill}`}
              radius="full"
              size="md"
              startContent={
                <span className="text-default-500">
                  <ArrowDownTrayIcon className="size-4" />
                </span>
              }
              variant="light"
            >
              <span className="flex flex-col items-start">
                <span className="text-sm leading-tight font-medium">Import from URL</span>
                <span className="text-default-500 text-xs leading-tight">Paste a recipe link</span>
              </span>
            </Button>
          </DropdownItem>

          <DropdownItem
            key="theme"
            isReadOnly
            className="py-2 data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent"
          >
            <ThemeSwitch />
          </DropdownItem>
          <DropdownItem
            key="settings"
            className="py-2 data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent"
          >
            <Button
              as="a"
              className={`w-full justify-start bg-transparent ${cssButtonPill}`}
              href="/settings?tab=user"
              radius="full"
              size="md"
              startContent={
                <span className="text-default-500">
                  <UsersIcon className="size-4" />
                </span>
              }
              variant="light"
              onPress={() => setUserMenuOpen(false)}
            >
              <span className="flex flex-col items-start">
                <span className="text-sm leading-tight font-medium">Settings</span>
                <span className="text-default-500 text-xs leading-tight">Manage your account</span>
              </span>
            </Button>
          </DropdownItem>
          <DropdownItem
            key="logout"
            className="py-2 data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent"
          >
            <Button
              className={`text-danger-400 w-full justify-start bg-transparent ${cssButtonPillDanger}`}
              color="danger"
              radius="full"
              size="md"
              startContent={
                <span className="text-danger-400">
                  <ArrowUpIcon className="size-4" />
                </span>
              }
              variant="light"
              onPress={() => {
                setUserMenuOpen(false);
                signOut();
              }}
            >
              <span className="text-sm font-medium">Logout</span>
            </Button>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      {/* Import from URL Modal */}
      <ImportRecipeModal isOpen={showUrlModal} onOpenChange={setShowUrlModal} />
    </>
  );
}
