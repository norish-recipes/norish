"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ImportFromImageModal from "@/components/shared/import-from-image-modal";
import ImportFromPasteModal from "@/components/shared/import-from-paste-modal";
import ImportRecipeModal from "@/components/shared/import-recipe-modal";
import { usePermissionsContext } from "@/context/permissions-context";
import {
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  PhotoIcon,
  PlusIcon,
} from "@heroicons/react/16/solid";
import { Button, Dropdown, Label } from "@heroui/react";
import { useTranslations } from "next-intl";

export default function CreateRecipeButton() {
  const router = useRouter();
  const { isAIEnabled } = usePermissionsContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const t = useTranslations("recipes.dashboard");
  const tCommon = useTranslations("common.actions");

  const openModal = useCallback((setModalOpen: (open: boolean) => void) => {
    setIsMenuOpen(false);
    setModalOpen(true);
  }, []);

  // Held in a memo so the element instances survive an unrelated re-render —
  // the menu's own open state lives here, so merely opening it re-renders this
  // component. What actually made rows detach mid-click was the item set
  // changing size; see the note on the image item below.
  const menuItems = useMemo(
    () => (
      <>
        <Dropdown.Item
          key="import"
          id="import"
          textValue={t("importFromUrl")}
          onPress={() => openModal(setShowImportModal)}
        >
          {<ArrowDownTrayIcon className="h-4 w-4" />}
          <Label>{t("importFromUrl")}</Label>
        </Dropdown.Item>
        <Dropdown.Item
          key="paste"
          id="paste"
          textValue={t("importFromPaste")}
          onPress={() => openModal(setShowPasteModal)}
        >
          {<ClipboardDocumentIcon className="h-4 w-4" />}
          <Label>{t("importFromPaste")}</Label>
        </Dropdown.Item>
        {/*
          Always in the collection, merely hidden when AI is off. Dropping the
          item outright made the menu change from three rows to four *after*
          mount, because isAIEnabled starts false while usePermissionsQuery is
          in flight and flips once it resolves. react-aria rebuilds its
          collection on that change and detaches whatever row the pointer is
          on. Holding the key set constant lets React reconcile in place.
          isDisabled keeps arrow-key navigation off the hidden row.
        */}
        <Dropdown.Item
          key="image"
          className={isAIEnabled ? undefined : "hidden"}
          id="image"
          isDisabled={!isAIEnabled}
          textValue={t("importFromImage")}
          onPress={() => openModal(setShowImageModal)}
        >
          {<PhotoIcon className="h-4 w-4" />}
          <Label>{t("importFromImage")}</Label>
        </Dropdown.Item>
        <Dropdown.Item
          key="create"
          id="create"
          textValue={tCommon("create")}
          onPress={() => router.push("/recipes/new")}
        >
          {<PlusIcon className="h-4 w-4" />}
          <Label>{tCommon("create")}</Label>
        </Dropdown.Item>
      </>
    ),
    [isAIEnabled, openModal, router, t, tCommon]
  );

  return (
    <>
      <Dropdown isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Button
          aria-label={t("addRecipe")}
          className="min-w-10 rounded-full font-medium md:min-w-20"
          size="md"
          variant="primary"
        >
          <PlusIcon className="h-5 w-5" />
          <span className="hidden md:inline">{t("addRecipe")}</span>
        </Button>
        <Dropdown.Popover className="bg-overlay" placement="bottom end">
          <Dropdown.Menu aria-label="Add recipe options">{menuItems}</Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      <ImportRecipeModal isOpen={showImportModal} onOpenChange={setShowImportModal} />
      <ImportFromPasteModal isOpen={showPasteModal} onOpenChange={setShowPasteModal} />
      {isAIEnabled && (
        <ImportFromImageModal isOpen={showImageModal} onOpenChange={setShowImageModal} />
      )}
    </>
  );
}
