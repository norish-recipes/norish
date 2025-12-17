"use client";

import React, { useEffect, useState } from "react";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { Avatar } from "@heroui/avatar";
import { Button } from "@heroui/react";
import { ArrowDownTrayIcon, ArrowUpIcon, PlusIcon, PhotoIcon } from "@heroicons/react/16/solid";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { UsersIcon } from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { ThemeSwitch } from "./theme-switch";

import ImportRecipeModal from "@/components/shared/import-recipe-modal";
import ImportFromImageModal from "@/components/shared/import-from-image-modal";
import { cssButtonPill, cssButtonPillDanger } from "@/config/css-tokens";
import { useUserContext } from "@/context/user-context";
import { usePermissionsContext } from "@/context/permissions-context";

type TriggerVariant = "avatar" | "ellipsis";

interface NavbarUserMenuProps {
  trigger?: TriggerVariant;
}

export default function NavbarUserMenu({ trigger = "avatar" }: NavbarUserMenuProps) {
  const { user, userMenuOpen, setUserMenuOpen, signOut } = useUserContext();
  const { isAIEnabled } = usePermissionsContext();
  const router = useRouter();
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => setMounted(true), []);

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
            <Avatar
              className="isBordered h-13 w-13 cursor-pointer text-lg"
              color="warning"
              imgProps={{
                onError: handleImageError,
              }}
              name={user?.name || user?.email || "U"}
              src={!imageError && user?.image ? `${user.image}?retry=${retryCount}` : undefined}
            />
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
            key="import-url"
            className="py-2 data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent"
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
              onPress={() => {
                setUserMenuOpen(false);
                setShowUrlModal(true);
              }}
            >
              <span className="flex flex-col items-start">
                <span className="text-sm leading-tight font-medium">Import from URL</span>
                <span className="text-default-500 text-xs leading-tight">Paste a recipe link</span>
              </span>
            </Button>
          </DropdownItem>

          {isAIEnabled ? (
            <DropdownItem
              key="import-image"
              className="py-2 data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent"
            >
              <Button
                className={`w-full justify-start bg-transparent ${cssButtonPill}`}
                radius="full"
                size="md"
                startContent={
                  <span className="text-default-500">
                    <PhotoIcon className="size-4" />
                  </span>
                }
                variant="light"
                onPress={() => {
                  setUserMenuOpen(false);
                  setShowImageModal(true);
                }}
              >
                <span className="flex flex-col items-start">
                  <span className="text-sm leading-tight font-medium">Import from Image</span>
                  <span className="text-default-500 text-xs leading-tight">Upload photos</span>
                </span>
              </Button>
            </DropdownItem>
          ) : null}

          <DropdownItem
            key="create-recipe"
            className="py-2 data-[focus=true]:bg-transparent data-[hover=true]:bg-transparent"
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
              onPress={() => router.push("/recipes/new")}
            >
              <span className="flex flex-col items-start">
                <span className="text-sm leading-tight font-medium">Create Recipe</span>
                <span className="text-default-500 text-xs leading-tight">
                  Write your own recipe
                </span>
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
              onPress={() => signOut()}
            >
              <span className="text-sm font-medium">Logout</span>
            </Button>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      {/* Import from URL Modal */}
      <ImportRecipeModal isOpen={showUrlModal} onOpenChange={setShowUrlModal} />

      {/* Import from Image Modal */}
      <ImportFromImageModal isOpen={showImageModal} onOpenChange={setShowImageModal} />

      {/* Backdrop - only render on client */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-[999] bg-black/40"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setUserMenuOpen(false)}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
