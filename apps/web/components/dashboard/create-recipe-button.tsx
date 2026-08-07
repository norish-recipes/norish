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

  // Held in a memo so the element instances survive a re-render. The menu's own
  // open state lives here, so merely opening it re-renders this component — and
  // a fresh set of Dropdown.Item elements makes react-aria rebuild its
  // collection and remount every row underneath the pointer. Playwright saw
  // that as "element was detached from the DOM" mid-click
  // (e2e-ai/enrichment.e2e.ts:175), and a person clicking quickly loses the
  // click the same way.
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
        {isAIEnabled ? (
          <Dropdown.Item
            key="image"
            id="image"
            textValue={t("importFromImage")}
            onPress={() => openModal(setShowImageModal)}
          >
            {<PhotoIcon className="h-4 w-4" />}
            <Label>{t("importFromImage")}</Label>
          </Dropdown.Item>
        ) : null}
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
    [isAIEnabled, openModal, router, t, tCommon],
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
