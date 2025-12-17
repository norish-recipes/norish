"use client";

import React, { useState } from "react";
import { Button } from "@heroui/react";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";
import { useRouter } from "next/navigation";
import { PlusIcon, ArrowDownTrayIcon, PhotoIcon } from "@heroicons/react/16/solid";

import ImportRecipeModal from "@/components/shared/import-recipe-modal";
import ImportFromImageModal from "@/components/shared/import-from-image-modal";
import { usePermissionsContext } from "@/context/permissions-context";

export default function CreateRecipeButton() {
  const router = useRouter();
  const { isAIEnabled } = usePermissionsContext();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);

  const menuItems = (
    <>
      <DropdownItem
        key="import"
        startContent={<ArrowDownTrayIcon className="h-4 w-4" />}
        onPress={() => setShowImportModal(true)}
      >
        URL
      </DropdownItem>
      {isAIEnabled ? (
        <DropdownItem
          key="image"
          startContent={<PhotoIcon className="h-4 w-4" />}
          onPress={() => setShowImageModal(true)}
        >
          Image
        </DropdownItem>
      ) : null}
      <DropdownItem
        key="create"
        startContent={<PlusIcon className="h-4 w-4" />}
        onPress={() => router.push("/recipes/new")}
      >
        Create
      </DropdownItem>
    </>
  );

  return (
    <>
      {/* Desktop */}
      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <Button
            className="hidden font-medium md:flex"
            color="primary"
            radius="full"
            size="md"
            startContent={<PlusIcon className="h-4 w-4" />}
          >
            Add Recipe
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Add recipe options">{menuItems}</DropdownMenu>
      </Dropdown>

      {/* Mobile */}
      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <Button isIconOnly className="mx-2 md:hidden" color="primary" radius="full" size="md">
            <PlusIcon className="h-5 w-5" />
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Add recipe options">{menuItems}</DropdownMenu>
      </Dropdown>

      <ImportRecipeModal isOpen={showImportModal} onOpenChange={setShowImportModal} />
      {isAIEnabled && (
        <ImportFromImageModal isOpen={showImageModal} onOpenChange={setShowImageModal} />
      )}
    </>
  );
}
