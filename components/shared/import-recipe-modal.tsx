"use client";

import { useState } from "react";
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
import { SparklesIcon, ArrowDownTrayIcon } from "@heroicons/react/20/solid";

import { useRecipesContext } from "@/context/recipes-context";
import { usePermissionsContext } from "@/context/permissions-context";

interface ImportRecipeModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportRecipeModal({ isOpen, onOpenChange }: ImportRecipeModalProps) {
  const { importRecipe, importRecipeWithAI } = useRecipesContext();
  const { isAIEnabled } = usePermissionsContext();
  const [importUrl, setImportUrl] = useState("");

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
        title: "Failed to import recipe",
        description: (e as Error).message,
        color: "danger",
        timeout: 2000,
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
        title: "Failed to import recipe with AI",
        description: (e as Error).message,
        color: "danger",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    }
  }

  return (
    <Modal isOpen={isOpen} size="md" onOpenChange={onOpenChange}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">Import recipe</ModalHeader>
            <ModalBody>
              <Input
                label="Recipe URL"
                placeholder="https://example.com/your-recipe"
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
                  AI Import
                </Button>
              )}
              <Button
                color="primary"
                startContent={<ArrowDownTrayIcon className="h-4 w-4" />}
                onPress={handleImportFromUrl}
              >
                Import
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

