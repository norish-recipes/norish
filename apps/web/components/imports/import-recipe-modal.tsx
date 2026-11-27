"use client";

import { useEffect, useState } from "react";
import { ActionButton } from "@/components/shared/action-button";
import ConfirmModal from "@/components/shared/confirm-modal";
import { readClipboardUrl } from "@/lib/clipboard-url";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ArrowDownTrayIcon, SparklesIcon } from "@heroicons/react/16/solid";
import { Input, Label, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

import { usePermissions } from "@norish/shared-react/reader";
import { useImportRecipe } from "@norish/shared-react/recipes";

interface ImportRecipeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}
export default function ImportRecipeModal({ isOpen, onOpenChange }: ImportRecipeModalProps) {
  const t = useTranslations("common.import.url");
  const tErrors = useTranslations("common.errors");
  const tActions = useTranslations("common.actions");
  const { importRecipe, importRecipeWithAI } = useImportRecipe();
  const isAIEnabled = usePermissions((p) => p.isAIEnabled);
  const [importUrl, setImportUrl] = useState("");

  function handleOpenChange(open: boolean) {
    if (!open) {
      setImportUrl("");
    }
    onOpenChange(open);
  }
  // A link already on the clipboard is what the person most likely came to
  // import, so it is offered as the field's value, never over something typed.
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    void readClipboardUrl().then((clipboardUrl) => {
      if (!clipboardUrl || isCancelled) return;
      setImportUrl((currentValue) => (currentValue.trim() === "" ? clipboardUrl : currentValue));
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);
  async function handleImportFromUrl() {
    if (importUrl.trim() === "") return;
    try {
      await importRecipe(importUrl);
      onOpenChange(false);
      setImportUrl("");
    } catch (e) {
      onOpenChange(false);
      setImportUrl("");
      showSafeErrorToast({
        title: t("failed"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error: e,
        context: "import-recipe-modal:import",
      });
    }
  }
  async function handleAIImport() {
    if (importUrl.trim() === "") return;
    try {
      await importRecipeWithAI(importUrl);
      onOpenChange(false);
      setImportUrl("");
    } catch (e) {
      onOpenChange(false);
      setImportUrl("");
      showSafeErrorToast({
        title: t("failedWithAI"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error: e,
        context: "import-recipe-modal:import-ai",
      });
    }
  }

  return (
    <ConfirmModal
      confirm={
        <>
          {isAIEnabled && (
            <ActionButton
              action="apply"
              icon={SparklesIcon}
              variant="secondary"
              onPress={handleAIImport}
            >
              {tActions("aiImport")}
            </ActionButton>
          )}
          <ActionButton action="apply" icon={ArrowDownTrayIcon} onPress={handleImportFromUrl}>
            {tActions("import")}
          </ActionButton>
        </>
      }
      isOpen={isOpen}
      title={t("title")}
      onOpenChange={handleOpenChange}
    >
      <TextField fullWidth inputMode="url" value={importUrl} onChange={setImportUrl}>
        <Label>{t("label")}</Label>
        <Input fullWidth placeholder={t("placeholder")} variant="secondary" />
      </TextField>
    </ConfirmModal>
  );
}
