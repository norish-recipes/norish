"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Button,
  addToast,
} from "@heroui/react";
import { SparklesIcon, ArrowDownTrayIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useRecipesContext } from "@/context/recipes-context";
import { usePermissionsContext } from "@/context/permissions-context";

interface ImportRecipeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportRecipeModal({ isOpen, onOpenChange }: ImportRecipeModalProps) {
  const t = useTranslations("common.import.url");
  const tActions = useTranslations("common.actions");
  const { importRecipe, importRecipeWithAI } = useRecipesContext();
  const { isAIEnabled } = usePermissionsContext();
  const [importUrl, setImportUrl] = useState("");

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
      addToast({
        title: t("failed"),
        description: (e as Error).message,
        color: "danger",
        shouldShowTimeoutProgress: true,
        radius: "full",
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
      addToast({
        title: t("failedWithAI"),
        description: (e as Error).message,
        color: "danger",
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    }
  }

  return (
    <Modal
      classNames={{ wrapper: "z-[1100]", backdrop: "z-[1099]" }}
      isOpen={isOpen}
      size="md"
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">{t("title")}</ModalHeader>
            <ModalBody>
              <Input
                label={t("label")}
                placeholder={t("placeholder")}
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
              />
            </ModalBody>
            <ModalFooter>
              {isAIEnabled && (
                <Button
                  className="bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 text-white hover:brightness-110"
                  startContent={<SparklesIcon className="h-4 w-4" />}
                  onPress={handleAIImport}
                >
                  {tActions("aiImport")}
                </Button>
              )}
              <Button
                color="primary"
                startContent={<ArrowDownTrayIcon className="h-4 w-4" />}
                onPress={handleImportFromUrl}
              >
                {tActions("import")}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
