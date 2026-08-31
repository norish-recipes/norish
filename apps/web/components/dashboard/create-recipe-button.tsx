"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CookbookIconSolid } from "@/components/cookbooks/cookbook-icon";
import { CookbookTitlePanel } from "@/components/cookbooks/cookbook-panels";
import ImportFromImageModal from "@/components/shared/import-from-image-modal";
import ImportFromPasteModal from "@/components/shared/import-from-paste-modal";
import ImportRecipeModal from "@/components/shared/import-recipe-modal";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useCookbooksMutations } from "@/hooks/cookbooks";
import {
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  PhotoIcon,
  PlusIcon,
} from "@heroicons/react/16/solid";
import { Button, Dropdown, Label } from "@heroui/react";
import { useTranslations } from "next-intl";

/**
 * The Library's Add button, which makes whichever kind of thing is on screen.
 *
 * Under **Cookbooks** it is **+ Cookbook** and asks for a title. Under
 * **Recipes** it is the recipe menu it has always been. Under **All** both
 * kinds are on screen, so both are in the menu and the button drops to a plain
 * **Add** — a list holding recipes and cookbooks together should not have an
 * Add button that can only make one of them, and one labelled "Add Recipe"
 * with a Cookbook inside it would be lying about the shorter half of itself.
 *
 * The button and the chips are load-bearing on each other: this is only honest
 * because the chip that decides its meaning is permanently on screen beside a
 * heading that names it (ADR-0026). If the chips ever move back behind search
 * focus, this has to stop being chip-aware in the same change.
 */
export default function CreateRecipeButton() {
  const router = useRouter();
  const { isAIEnabled } = usePermissionsContext();
  const { filters } = useRecipesFiltersContext();
  const { createCookbook } = useCookbooksMutations();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showCookbookPanel, setShowCookbookPanel] = useState(false);
  const t = useTranslations("recipes.dashboard");
  const tCookbooks = useTranslations("recipes.cookbooks");
  const tCommon = useTranslations("common.actions");
  const addsCookbook = filters.libraryType === "cookbooks";
  // Under All the list holds both kinds, so the menu offers both.
  const addsEither = filters.libraryType === "all";

  const handleCreateCookbook = useCallback(
    (title: string) => {
      // Made and left on the Library, not opened. The reader who has just
      // said "there should be a Christmas cookbook" is not asking to be
      // taken away from the list they were reading; the new cookbook appears
      // at the top of it, which is where the Cookbooks chip already has them
      // looking.
      void createCookbook({ title });
    },
    [createCookbook]
  );

  const openModal = useCallback((setModalOpen: (open: boolean) => void) => {
    setIsMenuOpen(false);
    setModalOpen(true);
  }, []);

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
        {addsEither ? (
          <Dropdown.Item
            key="cookbook"
            id="cookbook"
            textValue={tCookbooks("singular")}
            // The menu closes before the panel opens, so its items cannot
            // rebuild mid-exit and steal focus from the panel.
            onPress={() => openModal(setShowCookbookPanel)}
          >
            {<CookbookIconSolid className="h-4 w-4" />}
            <Label>{tCookbooks("singular")}</Label>
          </Dropdown.Item>
        ) : null}
      </>
    ),
    [addsEither, isAIEnabled, openModal, router, t, tCommon, tCookbooks]
  );

  const addLabel = addsEither ? tCommon("add") : t("addRecipe");

  if (addsCookbook) {
    return (
      <>
        <Button
          aria-label={tCookbooks("addCookbook")}
          className="min-w-10 rounded-full font-medium md:min-w-20"
          data-testid="add-cookbook-button"
          size="md"
          variant="primary"
          onPress={() => setShowCookbookPanel(true)}
        >
          <PlusIcon className="h-5 w-5" />
          <span className="hidden md:inline">{tCookbooks("singular")}</span>
        </Button>

        <CookbookTitlePanel
          open={showCookbookPanel}
          onOpenChange={setShowCookbookPanel}
          onSubmit={handleCreateCookbook}
        />
      </>
    );
  }

  return (
    <>
      <Dropdown isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Button
          aria-label={addLabel}
          className="min-w-10 rounded-full font-medium md:min-w-20"
          data-testid="add-library-button"
          size="md"
          variant="primary"
        >
          <PlusIcon className="h-5 w-5" />
          <span className="hidden md:inline">{addLabel}</span>
        </Button>
        <Dropdown.Popover className="bg-overlay" placement="bottom end">
          <Dropdown.Menu aria-label={addLabel}>{menuItems}</Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>

      {addsEither && (
        <CookbookTitlePanel
          open={showCookbookPanel}
          onOpenChange={setShowCookbookPanel}
          onSubmit={handleCreateCookbook}
        />
      )}

      <ImportRecipeModal isOpen={showImportModal} onOpenChange={setShowImportModal} />
      <ImportFromPasteModal isOpen={showPasteModal} onOpenChange={setShowPasteModal} />
      {isAIEnabled && (
        <ImportFromImageModal isOpen={showImageModal} onOpenChange={setShowImageModal} />
      )}
    </>
  );
}
