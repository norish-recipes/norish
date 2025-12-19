"use client";

import { useState, useCallback, useRef } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Kbd,
  addToast,
} from "@heroui/react";
import { PhotoIcon, XMarkIcon, SparklesIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";

import { useRecipesMutations } from "@/hooks/recipes";
import { useClipboardImagePaste } from "@/hooks/use-clipboard-image-paste";
import { ALLOWED_OCR_MIME_SET, MAX_OCR_FILE_SIZE, MAX_OCR_FILES } from "@/types";

interface ImportFromImageModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FilePreview {
  id: string;
  file: File;
  preview: string;
}

export default function ImportFromImageModal({ isOpen, onOpenChange }: ImportFromImageModalProps) {
  const router = useRouter();
  const { importRecipeFromImages } = useRecipesMutations();
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddFiles = useCallback((selectedFiles: File[] | FileList | null) => {
    if (!selectedFiles) return;

    const fileArray = Array.isArray(selectedFiles)
      ? selectedFiles
      : Array.from({ length: selectedFiles.length }, (_, idx) => selectedFiles[idx]!);

    const newFiles: FilePreview[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i]!;

      // Validate file type
      if (!ALLOWED_OCR_MIME_SET.has(file.type)) {
        addToast({
          title: "Invalid file type",
          description: `${file.name} is not a supported image format`,
          color: "danger",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
        continue;
      }

      // Validate file size
      if (file.size > MAX_OCR_FILE_SIZE) {
        addToast({
          title: "File too large",
          description: `${file.name} exceeds the 10MB limit`,
          color: "danger",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
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
      const total = prev.length + newFiles.length;

      if (total > MAX_OCR_FILES) {
        addToast({
          title: "Too many files",
          description: `Maximum ${MAX_OCR_FILES} files allowed`,
          color: "warning",
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });

        return [...prev, ...newFiles.slice(0, MAX_OCR_FILES - prev.length)];
      }

      return [...prev, ...newFiles];
    });
  }, []);

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleAddFiles(e.dataTransfer.files);
    },
    [handleAddFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleImport = useCallback(() => {
    if (files.length === 0) return;

    setIsSubmitting(true);

    try {
      // Pass raw File objects - FormData conversion happens in mutation
      importRecipeFromImages(files.map((f) => f.file));

      addToast({
        severity: "default",
        title: "Importing recipe from images...",
        description: "Analyzing your images, please wait...",
        timeout: 2000,
        shouldShowTimeoutProgress: true,
        radius: "full",
      });

      // Clean up and close
      files.forEach((f) => URL.revokeObjectURL(f.preview));
      setFiles([]);
      onOpenChange(false);
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
  }, [files, importRecipeFromImages, onOpenChange, router]);

  const _handleClose = useCallback(() => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    onOpenChange(false);
  }, [files, onOpenChange]);

  return (
    <Modal isOpen={isOpen} size="lg" onOpenChange={onOpenChange}>
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">Import from Image</ModalHeader>
            <ModalBody>
              {/* Dropzone */}
              <div
                className="border-default-300 hover:border-primary flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 transition-colors"
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <PhotoIcon className="text-default-400 h-12 w-12" />
                <div className="text-center">
                  <p className="text-default-600 text-sm font-medium">
                    Drop images here or click to browse
                  </p>
                  <p className="text-default-500 mt-1 flex items-center justify-center gap-1.5 text-xs">
                    <Kbd keys={["ctrl"]}>V</Kbd> to paste
                  </p>
                  <p className="text-default-400 mt-1 text-xs">
                    Supports JPG, PNG, WebP. Max 10MB per file.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  type="file"
                  onChange={(e) => handleAddFiles(e.target.files)}
                />
              </div>

              {/* File previews */}
              {files.length > 0 && (
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {files.map(({ id, file, preview }) => (
                    <div key={id} className="group relative">
                      <img
                        alt={file.name}
                        className="h-20 w-full rounded-lg object-cover"
                        src={preview}
                      />
                      <button
                        className="bg-danger absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-white opacity-0 transition-opacity group-hover:opacity-100"
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
                <p className="text-default-500 mt-2 text-center text-xs">
                  {files.length} images selected - they will be combined as one recipe
                </p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                className="bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 text-white hover:brightness-110"
                isDisabled={files.length === 0}
                isLoading={isSubmitting}
                startContent={!isSubmitting && <SparklesIcon className="h-4 w-4" />}
                onPress={handleImport}
              >
                Import with AI
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
