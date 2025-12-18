"use client";

import { useState, useCallback } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Textarea,
  addToast,
} from "@heroui/react";
import { ArrowDownTrayIcon, SparklesIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";

import { useRecipesMutations } from "@/hooks/recipes";
import { MAX_RECIPE_PASTE_CHARS } from "@/types/uploads";
import { usePermissionsContext } from "@/context/permissions-context";

interface ImportFromPasteModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportFromPasteModal({
  isOpen,
  onOpenChange,
}: ImportFromPasteModalProps) {
  const router = useRouter();
  const { isAIEnabled } = usePermissionsContext();
  const { importRecipeFromPaste, importRecipeFromPasteWithAI } = useRecipesMutations();
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImport = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed.length > MAX_RECIPE_PASTE_CHARS) {
      addToast({
        title: "Paste too large",
        description: `Maximum ${MAX_RECIPE_PASTE_CHARS.toLocaleString()} characters allowed`,
        color: "warning",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      importRecipeFromPaste(trimmed);

      addToast({
        severity: "default",
        title: "Importing recipe...",
        description: "Import in progress, please wait...",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });

      onOpenChange(false);
      setText("");
      router.push("/");
    } catch (error) {
      addToast({
        title: "Import failed",
        description: (error as Error).message,
        color: "danger",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [importRecipeFromPaste, onOpenChange, router, text]);

  const handleAIImport = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed.length > MAX_RECIPE_PASTE_CHARS) {
      addToast({
        title: "Paste too large",
        description: `Maximum ${MAX_RECIPE_PASTE_CHARS.toLocaleString()} characters allowed`,
        color: "warning",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      importRecipeFromPasteWithAI(trimmed);

      addToast({
        severity: "default",
        title: "Importing recipe with AI...",
        description: "Import in progress, please wait...",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });

      onOpenChange(false);
      setText("");
      router.push("/");
    } catch (error) {
      addToast({
        title: "Failed to import recipe with AI",
        description: (error as Error).message,
        color: "danger",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [importRecipeFromPasteWithAI, onOpenChange, router, text]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setText("");
  }, [onOpenChange]);

  return (
    <Modal isOpen={isOpen} size="lg" onOpenChange={onOpenChange}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">Import from paste</ModalHeader>
            <ModalBody>
              <Textarea
                label="Recipe text or JSON-LD"
                maxRows={18}
                minRows={8}
                placeholder="Paste a recipe (free text) or JSON-LD here..."
                value={text}
                onValueChange={setText}
              />
              <p className="text-default-500 text-xs">
                {text.length.toLocaleString()} / {MAX_RECIPE_PASTE_CHARS.toLocaleString()} characters
              </p>
            </ModalBody>
            <ModalFooter>
              {isAIEnabled && (
                <Button
                  className="bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 text-white hover:brightness-110"
                  isDisabled={text.trim().length === 0}
                  isLoading={isSubmitting}
                  startContent={!isSubmitting && <SparklesIcon className="h-4 w-4" />}
                  onPress={handleAIImport}
                >
                  AI Import
                </Button>
              )}
              <Button
                color="primary"
                isDisabled={text.trim().length === 0}
                isLoading={isSubmitting}
                startContent={!isSubmitting && <ArrowDownTrayIcon className="h-4 w-4" />}
                onPress={handleImport}
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
