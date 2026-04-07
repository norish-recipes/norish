"use client";

import type { DragEndEvent } from "@dnd-kit/core";
import React, { useRef, useState } from "react";
import NextImage from "next/image";
import { useRecipeImages } from "@/hooks/recipes";
import { useClipboardImagePaste } from "@/hooks/use-clipboard-image-paste";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bars2Icon, PhotoIcon, StarIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { MAX_RECIPE_IMAGES } from "@norish/shared/contracts/zod/recipe-images";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("ImageGalleryInput");

export interface RecipeGalleryImage {
  id?: string;
  image: string;
  order: number;
  version?: number;
}

export interface ImageGalleryInputProps {
  images: RecipeGalleryImage[];
  onChange: (images: RecipeGalleryImage[]) => void;
  recipeId: string;
  maxImages?: number;
}

interface SortableImageItemProps {
  item: RecipeGalleryImage;
  index: number;
  onDelete: (id: string | undefined, imageUrl: string, version?: number) => void;
}

function SortableImageItem({ item, index, onDelete }: SortableImageItemProps) {
  // Use image URL as unique ID since id may be undefined for new uploads
  const itemId = item.id || item.image;

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: itemId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className="bg-default-100 relative aspect-square w-28 shrink-0 overflow-hidden rounded-xl shadow-sm sm:w-32"
      style={style}
    >
      {/* Drag handle - always visible */}
      <button
        ref={setActivatorNodeRef}
        className="absolute top-2 left-2 z-20 flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-full bg-black/60 text-white active:cursor-grabbing"
        type="button"
        {...attributes}
        {...listeners}
      >
        <Bars2Icon className="h-3.5 w-3.5" />
      </button>

      {/* Primary badge */}
      {index === 0 && (
        <div className="bg-warning absolute top-2 left-10 z-10 flex h-6 w-6 items-center justify-center rounded-full text-white shadow">
          <StarIcon className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Delete button */}
      <button
        className="bg-danger absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-white shadow"
        type="button"
        onClick={() => onDelete(item.id, item.image, item.version)}
      >
        <XMarkIcon className="h-3.5 w-3.5" />
      </button>

      {/* Image */}
      <NextImage
        fill
        unoptimized
        alt={`Gallery image ${index + 1}`}
        className="object-cover"
        src={item.image}
      />

      {/* Order badge */}
      <div className="absolute right-2 bottom-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
        {index + 1}
      </div>
    </div>
  );
}

export default function ImageGalleryInput({
  images,
  onChange,
  recipeId,
  maxImages = MAX_RECIPE_IMAGES,
}: ImageGalleryInputProps) {
  const t = useTranslations("recipes.gallery");
  const { uploadGalleryImage, deleteGalleryImage } = useRecipeImages();

  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configure sensors for mouse, touch, and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require 5px movement before activating (prevents accidental drags)
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      // Press delay for touch to distinguish from scroll
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get unique IDs for SortableContext
  const itemIds = images.map((img) => img.id || img.image);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = itemIds.indexOf(active.id as string);
      const newIndex = itemIds.indexOf(over.id as string);

      const newOrder = arrayMove(images, oldIndex, newIndex);
      const reordered = newOrder.map((img, idx) => ({ ...img, order: idx }));

      onChange(reordered);
    }
  };

  const handleUpload = async (file: File) => {
    if (images.length >= maxImages) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const nextOrder = images.length;
      const result = await uploadGalleryImage(file, recipeId, nextOrder);

      if (result.success && result.url) {
        const newImage: RecipeGalleryImage = {
          id: result.id,
          image: result.url,
          order: result.order ?? nextOrder,
          version: result.version,
        };

        onChange([...images, newImage]);
      } else if (result.error) {
        setUploadError(result.error);
        setTimeout(() => setUploadError(null), 3000);
      }
    } catch (err) {
      log.error({ err }, "Failed to upload gallery image");
      setUploadError(t("uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string | undefined, imageUrl: string, version?: number) => {
    const newImages = images.filter((img) => img.image !== imageUrl);
    const reordered = newImages.map((img, idx) => ({ ...img, order: idx }));

    onChange(reordered);

    try {
      if (id) {
        await deleteGalleryImage(id, version ?? 1);
      }
    } catch (err) {
      log.error({ err }, "Failed to delete gallery image");
    }
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length < maxImages) setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length < maxImages) setDragActive(true);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (images.length >= maxImages) return;
    if (e.dataTransfer.files?.[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleUpload(e.target.files[0]);
      e.target.value = "";
    }
  };

  const { getOnPasteHandler } = useClipboardImagePaste({
    onFiles: (files) => {
      if (files.length > 0 && images.length < maxImages) {
        handleUpload(files[0]);
      }
    },
  });
  const onPaste = getOnPasteHandler();

  const isLimitReached = images.length >= maxImages;

  return (
    <div className="w-full min-w-0 space-y-3">
      {/* Scrollable container */}
      <div
        className="scrollbar-hide w-full min-w-0 overflow-x-auto pb-2"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={itemIds} strategy={horizontalListSortingStrategy}>
            <div className="flex w-max gap-3">
              {images.map((item, index) => (
                <SortableImageItem
                  key={item.id || item.image}
                  index={index}
                  item={item}
                  onDelete={handleDelete}
                />
              ))}

              {/* Add button - outside sortable context */}
              {!isLimitReached && (
                <button
                  className={[
                    "relative flex aspect-square w-28 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed sm:w-32",
                    dragActive
                      ? "border-primary bg-primary-50 dark:bg-primary-900/20"
                      : "border-default-300 hover:border-primary",
                    isUploading ? "pointer-events-none opacity-50" : "",
                  ].join(" ")}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={onDragEnter}
                  onDragLeave={onDragLeave}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onPaste={onPaste}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                      <span className="text-primary text-xs">{t("uploading")}</span>
                    </div>
                  ) : (
                    <div className="text-default-400 flex flex-col items-center gap-1">
                      <PhotoIcon className="h-8 w-8" />
                      <span className="text-primary text-xs font-medium">{t("addImage")}</span>
                    </div>
                  )}

                  {uploadError && (
                    <div className="bg-danger-50 text-danger absolute inset-0 flex items-center justify-center rounded-xl p-2 text-center text-xs">
                      {uploadError}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    type="file"
                    onChange={onFileChange}
                  />
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Footer */}
      <div className="text-default-400 flex items-center justify-between text-xs">
        <span>{t("dragToReorder")}</span>
        <span>
          {images.length} / {maxImages}
        </span>
      </div>
    </div>
  );
}
