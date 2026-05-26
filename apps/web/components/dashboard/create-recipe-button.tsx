"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  PhotoIcon,
  PlusIcon,
} from "@heroicons/react/16/solid";
import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/dropdown";
import { Button } from "@heroui/react";
import { useTranslations } from "next-intl";

import ImportFromImageModal from "@/components/shared/import-from-image-modal";
import ImportFromPasteModal from "@/components/shared/import-from-paste-modal";
import ImportRecipeModal from "@/components/shared/import-recipe-modal";
import { usePermissionsContext } from "@/context/permissions-context";

export default function CreateRecipeButton() {
  const router = useRouter();
  const { isAIEnabled } = usePermissionsContext();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const t = useTranslations("recipes.dashboard");
  const tCommon = useTranslations("common.actions");

  const menuItems = (
    <>
      <DropdownItem
        key="import"
        startContent={<ArrowDownTrayIcon className="h-4 w-4" />}
        onPress={() => setShowImportModal(true)}
      >
        {t("importFromUrl")}
      </DropdownItem>
      <DropdownItem
        key="paste"
        startContent={<ClipboardDocumentIcon className="h-4 w-4" />}
        onPress={() => setShowPasteModal(true)}
      >
        {t("importFromPaste")}
      </DropdownItem>
      {isAIEnabled ? (
        <DropdownItem
          key="image"
          startContent={<PhotoIcon className="h-4 w-4" />}
          onPress={() => setShowImageModal(true)}
        >
          {t("importFromImage")}
        </DropdownItem>
      ) : null}
      <DropdownItem
        key="create"
        startContent={<PlusIcon className="h-4 w-4" />}
        onPress={() => router.push("/recipes/new")}
      >
        {tCommon("create")}
      </DropdownItem>
    </>
  );

  return (
    <>
      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <Button
            className="mx-2 font-medium min-w-10 w-10 h-10 px-0 md:mx-0 md:w-auto md:px-4"
            color="primary"
            radius="full"
            size="md"
          >
            <PlusIcon className="h-5 w-5 shrink-0" />
            <span className="hidden md:inline md:ml-1.5">{t("addRecipe")}</span>
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Add recipe options">{menuItems}</DropdownMenu>
      </Dropdown>

      <ImportRecipeModal isOpen={showImportModal} onOpenChange={setShowImportModal} />
      <ImportFromPasteModal isOpen={showPasteModal} onOpenChange={setShowPasteModal} />
      {isAIEnabled && (
        <ImportFromImageModal isOpen={showImageModal} onOpenChange={setShowImageModal} />
      )}
    </>
  );
}
