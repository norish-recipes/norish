"use client";

import type { DropZoneAreaProps } from "@/components/ui/drop-zone";
import { useCallback, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { DropZone } from "@/components/ui/drop-zone";
import { useUploadLimitsQuery } from "@/hooks/config";
import { useRecipesMutations } from "@/hooks/recipes";
import { useClipboardImagePaste } from "@/hooks/use-clipboard-image-paste";
import { showSafeErrorToast } from "@/lib/ui/safe-error-toast";
import { PhotoIcon, SparklesIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button, Kbd, Modal, toast } from "@heroui/react";
import { useTranslations } from "next-intl";

import {
  ALLOWED_OCR_MIME_SET,
  ALLOWED_OCR_MIME_TYPES,
  MAX_OCR_FILES,
} from "@norish/shared/contracts";

interface ImportFromImageModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}
interface FilePreview {
  id: string;
  file: File;
  preview: string;
}
const OCR_IMAGE_ACCEPT = ALLOWED_OCR_MIME_TYPES.join(",");

export default function ImportFromImageModal({ isOpen, onOpenChange }: ImportFromImageModalProps) {
  const t = useTranslations("common.import.image");
  const tErrors = useTranslations("common.errors");
  const tActions = useTranslations("common.actions");
  const router = useRouter();
  const { importRecipeFromImages } = useRecipesMutations();
  const { limits } = useUploadLimitsQuery();
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleAddFiles = useCallback(
    (selectedFiles: File[] | FileList | null) => {
      if (!selectedFiles) return;
      const fileArray = Array.isArray(selectedFiles)
        ? selectedFiles
        : Array.from(
            {
              length: selectedFiles.length,
            },
            (_, idx) => selectedFiles[idx]!
          );
      const newFiles: FilePreview[] = [];

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i]!;

        // Validate file type
        if (!ALLOWED_OCR_MIME_SET.has(file.type)) {
          toast(t("invalidType"), {
            description: t("notSupported", {
              name: file.name,
            }),
            variant: "danger",
          });
          continue;
        }

        // Validate file size
        if (file.size > limits.maxImageSize) {
          toast(t("tooLarge"), {
            description: t("exceeds", {
              name: file.name,
            }),
            variant: "danger",
          });
          continue;
        }

        // Create preview
        newFiles.push({
          id: `${Date.now()}-${i}-${file.name}`,
          file,
          preview: URL.createObjectURL(file),
        });
      }
      setFiles((prev) => {
        const availableSlots = MAX_OCR_FILES - prev.length;

        if (availableSlots <= 0) {
          newFiles.forEach((file) => URL.revokeObjectURL(file.preview));
          toast(t("tooMany"), {
            description: t("maxFiles", {
              max: MAX_OCR_FILES,
            }),
            variant: "warning",
          });

          return prev;
        }
        if (newFiles.length > availableSlots) {
          const acceptedFiles = newFiles.slice(0, availableSlots);

          newFiles.slice(availableSlots).forEach((file) => URL.revokeObjectURL(file.preview));
          toast(t("tooMany"), {
            description: t("maxFiles", {
              max: MAX_OCR_FILES,
            }),
            variant: "warning",
          });

          return [...prev, ...acceptedFiles];
        }

        return [...prev, ...newFiles];
      });
    },
    [t, limits.maxImageSize]
  );

  useClipboardImagePaste({
    enabled: isOpen,
    onFiles: (pastedFiles) => handleAddFiles(pastedFiles),
  });
  const handleRemoveFile = useCallback((id: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === id);

      if (file) URL.revokeObjectURL(file.preview);

      return prev.filter((f) => f.id !== id);
    });
  }, []);
  const handleDrop = useCallback<NonNullable<DropZoneAreaProps["onDrop"]>>(
    (event) => {
      void (async () => {
        const droppedFiles: File[] = [];

        for (const item of event.items) {
          if (item.kind === "file") {
            droppedFiles.push(await item.getFile());
          }
        }

        handleAddFiles(droppedFiles);
      })();
    },
    [handleAddFiles]
  );
  const getDropOperation = useCallback<NonNullable<DropZoneAreaProps["getDropOperation"]>>(
    (types) => (ALLOWED_OCR_MIME_TYPES.some((type) => types.has(type)) ? "copy" : "cancel"),
    []
  );
  const handleImport = useCallback(() => {
    if (files.length === 0) return;
    setIsSubmitting(true);
    try {
      // Pass raw File objects - FormData conversion happens in mutation
      importRecipeFromImages(files.map((f) => f.file));
      toast(t("importing"), {
        description: t("analyzing"),
        variant: "default",
      });

      // Clean up and close
      files.forEach((f) => {
        URL.revokeObjectURL(f.preview);
      });
      setFiles([]);
      onOpenChange(false);
      router.push("/");
    } catch (error) {
      showSafeErrorToast({
        title: t("failed"),
        description: tErrors("technicalDetails"),
        color: "danger",
        error,
        context: "import-from-image-modal:import",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [files, importRecipeFromImages, onOpenChange, router, t, tErrors]);
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        files.forEach((f) => {
          URL.revokeObjectURL(f.preview);
        });
        setFiles([]);
      }
      onOpenChange(open);
    },
    [files, onOpenChange]
  );

  return (
    <Modal.Backdrop className="z-[1099]" isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Modal.Container className="z-[1100]" size="lg">
        <Modal.Dialog>
          {() => (
            <>
              <Modal.CloseTrigger />
              <Modal.Header className="flex flex-col gap-1">{t("title")}</Modal.Header>
              <Modal.Body>
                <DropZone className="w-full">
                  <DropZone.Area getDropOperation={getDropOperation} onDrop={handleDrop}>
                    <DropZone.Icon>
                      <PhotoIcon />
                    </DropZone.Icon>
                    <DropZone.Label>{t("dropzone")}</DropZone.Label>
                    <DropZone.Description>{t("formats")}</DropZone.Description>
                    <DropZone.Description className="flex items-center justify-center gap-1.5">
                      <Kbd keys={["ctrl"]}>V</Kbd> {t("paste")}
                    </DropZone.Description>
                    <DropZone.Trigger>{t("library")}</DropZone.Trigger>
                  </DropZone.Area>
                  <DropZone.Input multiple accept={OCR_IMAGE_ACCEPT} onSelect={handleAddFiles} />
                </DropZone>

                {/* File previews */}
                {files.length > 0 && (
                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {files.map(({ id, file, preview }) => (
                      <div key={id} className="group relative">
                        <Image
                          unoptimized
                          alt={file.name}
                          className="h-20 w-full rounded-lg object-cover"
                          height={80}
                          src={preview}
                          width={160}
                        />
                        <button
                          aria-label={`Remove ${file.name}`}
                          className="bg-danger absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(id);
                          }}
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {files.length > 1 && (
                  <p className="text-muted mt-2 text-center text-xs">
                    {t("selectedCount", {
                      count: files.length,
                    })}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button
                  isDisabled={files.length === 0}
                  isPending={isSubmitting}
                  variant="primary"
                  onPress={handleImport}
                >
                  {!isSubmitting && <SparklesIcon className="h-4 w-4" />}
                  {tActions("importWithAI")}
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
