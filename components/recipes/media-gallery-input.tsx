"use client";

import React, { useRef, useState, useCallback } from "react";
import NextImage from "next/image";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  XMarkIcon,
  PhotoIcon,
  StarIcon,
  Bars2Icon,
  PlayIcon,
  VideoCameraIcon,
} from "@heroicons/react/16/solid";
import { useTranslations } from "next-intl";

import { useRecipeImages, useRecipeVideos } from "@/hooks/recipes";
import { useClipboardImagePaste } from "@/hooks/use-clipboard-image-paste";
import { MAX_RECIPE_IMAGES } from "@/server/db/zodSchemas/recipe-images";
import { MAX_RECIPE_VIDEOS } from "@/server/db/zodSchemas/recipe-videos";
import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("MediaGalleryInput");

export interface RecipeGalleryMedia {
  id?: string;
  type: "image" | "video";
  src: string;
  thumbnail?: string | null;
  duration?: number | null;
  order: number;
}

export interface MediaGalleryInputProps {
  media: RecipeGalleryMedia[];
  onChange: (media: RecipeGalleryMedia[]) => void;
  recipeId: string;
  maxImages?: number;
  maxVideos?: number;
}

interface SortableMediaItemProps {
  item: RecipeGalleryMedia;
  index: number;
  onDelete: (id: string | undefined, src: string, type: "image" | "video") => void;
  isFirstImage: boolean;
}

/**
 * Format duration in seconds to mm:ss
 */
function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function SortableMediaItem({ item, index, onDelete, isFirstImage }: SortableMediaItemProps) {
  const itemId = item.id || item.src;

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

  const isVideo = item.type === "video";
  const durationStr = formatDuration(item.duration);

  return (
    <div
      ref={setNodeRef}
      className="bg-default-100 relative aspect-square w-28 shrink-0 overflow-hidden rounded-xl shadow-sm sm:w-32"
      style={style}
    >
      {/* Drag handle */}
      <button
        ref={setActivatorNodeRef}
        className="absolute top-2 left-2 z-20 flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-full bg-black/60 text-white active:cursor-grabbing"
        type="button"
        {...attributes}
        {...listeners}
      >
        <Bars2Icon className="h-3.5 w-3.5" />
      </button>

      {/* Primary badge (only for first image) */}
      {isFirstImage && item.type === "image" && (
        <div className="bg-warning absolute top-2 left-10 z-10 flex h-6 w-6 items-center justify-center rounded-full text-white shadow">
          <StarIcon className="h-3.5 w-3.5" />
        </div>
      )}

      {/* Delete button */}
      <button
        className="bg-danger absolute top-2 right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-white shadow"
        type="button"
        onClick={() => onDelete(item.id, item.src, item.type)}
      >
        <XMarkIcon className="h-3.5 w-3.5" />
      </button>

      {/* Media content */}
      {isVideo ? (
        <>
          {/* Video thumbnail or placeholder */}
          {item.thumbnail ? (
            <NextImage
              fill
              unoptimized
              alt={`Video ${index + 1}`}
              className="object-cover"
              src={item.thumbnail}
            />
          ) : (
            <div className="bg-default-200 flex h-full w-full items-center justify-center">
              <VideoCameraIcon className="text-default-400 h-12 w-12" />
            </div>
          )}
          {/* Play icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50">
              <PlayIcon className="h-5 w-5 text-white" />
            </div>
          </div>
          {/* Duration badge */}
          {durationStr && (
            <div className="absolute bottom-2 left-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
              {durationStr}
            </div>
          )}
        </>
      ) : (
        <NextImage
          fill
          unoptimized
          alt={`Image ${index + 1}`}
          className="object-cover"
          src={item.src}
        />
      )}

      {/* Order badge */}
      <div className="absolute right-2 bottom-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
        {index + 1}
      </div>
    </div>
  );
}

export default function MediaGalleryInput({
  media,
  onChange,
  recipeId,
  maxImages = MAX_RECIPE_IMAGES,
  maxVideos = MAX_RECIPE_VIDEOS,
}: MediaGalleryInputProps) {
  const t = useTranslations("recipes.gallery");
  const tActions = useTranslations("common.actions");
  const { uploadGalleryImage, deleteGalleryImage } = useRecipeImages();
  const { uploadGalleryVideo, deleteGalleryVideo } = useRecipeVideos();

  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Count images and videos
  const imageCount = media.filter((m) => m.type === "image").length;
  const videoCount = media.filter((m) => m.type === "video").length;

  // Find index of first image for primary badge
  const firstImageIndex = media.findIndex((m) => m.type === "image");

  // Configure sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get unique IDs for SortableContext
  const itemIds = media.map((m) => m.id || m.src);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = itemIds.indexOf(active.id as string);
      const newIndex = itemIds.indexOf(over.id as string);

      const newOrder = arrayMove(media, oldIndex, newIndex);
      const reordered = newOrder.map((item, idx) => ({ ...item, order: idx }));

      onChange(reordered);
    }
  };

  /**
   * Get video duration using HTML video element
   */
  const getVideoDuration = (file: File): Promise<number | undefined> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");

      video.preload = "metadata";

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(undefined);
      };

      video.src = URL.createObjectURL(file);
    });
  };

  const handleUpload = useCallback(
    async (file: File) => {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");

      if (!isVideo && !isImage) {
        setUploadError("Invalid file type");
        setTimeout(() => setUploadError(null), 3000);

        return;
      }

      // Check limits
      if (isImage && imageCount >= maxImages) {
        setUploadError(`Maximum ${maxImages} images allowed`);
        setTimeout(() => setUploadError(null), 3000);

        return;
      }

      if (isVideo && videoCount >= maxVideos) {
        setUploadError(`Maximum ${maxVideos} videos allowed`);
        setTimeout(() => setUploadError(null), 3000);

        return;
      }

      setIsUploading(true);
      setUploadError(null);

      try {
        const nextOrder = media.length;

        if (isVideo) {
          // Get duration from video file
          const duration = await getVideoDuration(file);

          const result = await uploadGalleryVideo(file, recipeId, nextOrder, duration);

          if (result.success && result.url) {
            const newMedia: RecipeGalleryMedia = {
              id: result.id,
              type: "video",
              src: result.url,
              thumbnail: result.thumbnail,
              duration: result.duration,
              order: result.order ?? nextOrder,
            };

            onChange([...media, newMedia]);
          } else if (result.error) {
            setUploadError(result.error);
            setTimeout(() => setUploadError(null), 3000);
          }
        } else {
          const result = await uploadGalleryImage(file, recipeId, nextOrder);

          if (result.success && result.url) {
            const newMedia: RecipeGalleryMedia = {
              id: result.id,
              type: "image",
              src: result.url,
              order: result.order ?? nextOrder,
            };

            onChange([...media, newMedia]);
          } else if (result.error) {
            setUploadError(result.error);
            setTimeout(() => setUploadError(null), 3000);
          }
        }
      } catch (err) {
        log.error({ err }, "Failed to upload media");
        setUploadError(t("uploadFailed"));
        setTimeout(() => setUploadError(null), 3000);
      } finally {
        setIsUploading(false);
      }
    },
    [
      media,
      imageCount,
      videoCount,
      maxImages,
      maxVideos,
      uploadGalleryImage,
      uploadGalleryVideo,
      recipeId,
      onChange,
      t,
    ]
  );

  const handleDelete = useCallback(
    async (id: string | undefined, src: string, type: "image" | "video") => {
      const newMedia = media.filter((m) => m.src !== src);
      const reordered = newMedia.map((m, idx) => ({ ...m, order: idx }));

      onChange(reordered);

      try {
        if (id) {
          if (type === "video") {
            await deleteGalleryVideo(id);
          } else {
            await deleteGalleryImage(id);
          }
        }
      } catch (err) {
        log.error({ err }, "Failed to delete media");
      }
    },
    [media, onChange, deleteGalleryImage, deleteGalleryVideo]
  );

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (imageCount < maxImages || videoCount < maxVideos) setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (imageCount < maxImages || videoCount < maxVideos) setDragActive(true);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

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
      if (files.length > 0) {
        handleUpload(files[0]);
      }
    },
  });
  const onPaste = getOnPasteHandler();

  const canAddMore = imageCount < maxImages || videoCount < maxVideos;

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
              {media.map((item, index) => (
                <SortableMediaItem
                  key={item.id || item.src}
                  index={index}
                  isFirstImage={index === firstImageIndex}
                  item={item}
                  onDelete={handleDelete}
                />
              ))}

              {/* Add button */}
              {canAddMore && (
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
                      <span className="text-primary text-xs font-medium">{tActions("add")}</span>
                    </div>
                  )}

                  {uploadError && (
                    <div className="bg-danger-50 text-danger absolute inset-0 flex items-center justify-center rounded-xl p-2 text-center text-xs">
                      {uploadError}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    accept="image/*,video/mp4,video/webm,video/quicktime"
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
          {imageCount}/{maxImages} images, {videoCount}/{maxVideos} videos
        </span>
      </div>
    </div>
  );
}
