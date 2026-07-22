"use client";

import { useEffect, useState } from "react";
import { usePermissionsContext } from "@/context/permissions-context";
import { useRecipesContext } from "@/context/recipes-context";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { ArrowDownTrayIcon, SparklesIcon } from "@heroicons/react/16/solid";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

interface ImportRecipeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}
export default function ImportRecipeModal({ isOpen, onOpenChange }: ImportRecipeModalProps) {
  const t = useTranslations("common.import.url");
  const tErrors = useTranslations("common.errors");
  const tActions = useTranslations("common.actions");
  const { importRecipe, importRecipeWithAI } = useRecipesContext();
  const { isAIEnabled } = usePermissionsContext();
  const [importUrl, setImportUrl] = useState("");

  function handleOpenChange(open: boolean) {
    if (!open) {
      setImportUrl("");
    }
    onOpenChange(open);
  }
  useEffect(() => {
    if (!isOpen || typeof navigator === "undefined" || !navigator.clipboard?.readText) {
      return;
    }
    let isCancelled = false;

    async function fillUrlFromClipboard() {
      try {
        const clipboardText = (await navigator.clipboard.readText()).trim();

        if (!clipboardText) {
          return;
        }
        const parsedUrl = new URL(clipboardText);
        const isHttpUrl = parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";

        if (isHttpUrl && !isCancelled) {
          setImportUrl((currentValue) =>
            currentValue.trim() === "" ? clipboardText : currentValue
          );
        }
      } catch {}
    }
    void fillUrlFromClipboard();

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
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Container className="z-[1100]" size="md">
        <Modal.Dialog>
          {() => (
            <>
              <Modal.CloseTrigger />
              <Modal.Header className="flex flex-col gap-1">{t("title")}</Modal.Header>
              <Modal.Body>
                <TextField fullWidth type="url" value={importUrl} onChange={setImportUrl}>
                  <Label>{t("label")}</Label>
                  <Input fullWidth placeholder={t("placeholder")} variant="secondary" />
                </TextField>
              </Modal.Body>
              <Modal.Footer>
                {isAIEnabled && (
                  <Button variant="secondary" onPress={handleAIImport}>
                    {<SparklesIcon className="h-4 w-4" />}
                    {tActions("aiImport")}
                  </Button>
                )}
                <Button variant="primary" onPress={handleImportFromUrl}>
                  {<ArrowDownTrayIcon className="h-4 w-4" />}
                  {tActions("import")}
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
