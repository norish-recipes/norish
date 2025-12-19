"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button, Image } from "@heroui/react";
import { XMarkIcon, PhotoIcon, Bars3Icon } from "@heroicons/react/16/solid";
import { Reorder, useDragControls } from "motion/react";

import SmartTextInput from "@/components/shared/smart-text-input";
import { MeasurementSystem } from "@/types";
import { useRecipeImages } from "@/hooks/recipes";

export interface StepImage {
  image: string;
  order: number;
}

export interface Step {
  step: string;
  order: number;
  systemUsed: MeasurementSystem;
  images?: StepImage[];
}

export interface StepInputProps {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  systemUsed?: MeasurementSystem;
  recipeId?: string; // Required for image uploads
}

// Internal type with stable IDs for reordering
interface StepItem {
  id: string;
  text: string;
  images: StepImage[];
}

let nextId = 0;

function createStepItem(text: string, images: StepImage[] = []): StepItem {
  return { id: `step-${nextId++}`, text, images };
}

export default function StepInput({
  steps,
  onChange,
  systemUsed = "metric",
  recipeId,
}: StepInputProps) {
  const [items, setItems] = useState<StepItem[]>([createStepItem("", [])]);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const dragConstraintsRef = useRef<HTMLUListElement>(null);

  const { uploadStepImage, deleteStepImage } = useRecipeImages();

  // Initialize from steps prop
  useEffect(() => {
    if (
      steps.length > 0 &&
      items.length === 1 &&
      items[0].text === "" &&
      items[0].images.length === 0
    ) {
      setItems([
        ...steps.map((s) => createStepItem(s.step, s.images || [])),
        createStepItem("", []),
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  const emitChanges = useCallback(
    (updatedItems: StepItem[]) => {
      const parsed = updatedItems
        .map((item, idx) => ({
          step: item.text.trim(),
          order: idx,
          systemUsed,
          images: item.images,
        }))
        .filter((s) => s.step || s.images.length > 0);

      onChange(parsed);
    },
    [onChange, systemUsed]
  );

  const handleInputChange = useCallback(
    (index: number, value: string) => {
      const updated = [...items];

      updated[index] = { ...updated[index], text: value };

      // Auto-add empty line at the end
      if (index === items.length - 1 && value.trim()) {
        updated.push(createStepItem("", []));
      }

      setItems(updated);
      emitChanges(updated);
    },
    [items, emitChanges]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (index < items.length - 1) {
          textareaRefs.current[index + 1]?.focus();
        } else {
          const updated = [...items, createStepItem("", [])];

          setItems(updated);
          setTimeout(() => {
            textareaRefs.current[items.length]?.focus();
          }, 0);
        }
      } else if (e.key === "Backspace" && !items[index].text && index > 0) {
        e.preventDefault();
        const updated = items.filter((_, i) => i !== index);

        setItems(updated);
        emitChanges(updated);
        setTimeout(() => {
          textareaRefs.current[index - 1]?.focus();
        }, 0);
      }
    },
    [items, emitChanges]
  );

  const handleBlur = useCallback(
    (index: number) => {
      // Auto-remove empty rows on blur (except the last one)
      if (
        !items[index].text.trim() &&
        items[index].images.length === 0 &&
        index < items.length - 1
      ) {
        const updated = items.filter((_, i) => i !== index);

        if (updated.length === 0) updated.push(createStepItem("", []));
        setItems(updated);
        emitChanges(updated);
      }
    },
    [items, emitChanges]
  );

  const handleRemove = useCallback(
    (index: number) => {
      // Delete all images for this step
      const stepImages = items[index].images;

      stepImages.forEach((img) => {
        deleteStepImage(img.image).catch((err) => {
          // eslint-disable-next-line no-console
          console.error("Failed to delete step image:", err);
        });
      });

      const updated = items.filter((_, i) => i !== index);

      if (updated.length === 0) updated.push(createStepItem("", []));
      setItems(updated);
      emitChanges(updated);
    },
    [items, emitChanges, deleteStepImage]
  );

  const handleImageUpload = useCallback(
    async (index: number, file: File) => {
      if (!recipeId) return;

      setUploadingIndex(index);

      try {
        const result = await uploadStepImage(file, recipeId);

        if (result.success && result.url) {
          const updated = [...items];
          const newImage: StepImage = {
            image: result.url,
            order: updated[index].images.length,
          };

          updated[index] = {
            ...updated[index],
            images: [...updated[index].images, newImage],
          };
          setItems(updated);
          emitChanges(updated);
        }
      } finally {
        setUploadingIndex(null);
      }
    },
    [recipeId, items, emitChanges, uploadStepImage]
  );

  const handleRemoveImage = useCallback(
    (stepIndex: number, imageIndex: number) => {
      const imageUrl = items[stepIndex].images[imageIndex]?.image;

      if (imageUrl) {
        deleteStepImage(imageUrl).catch((err) => {
          // eslint-disable-next-line no-console
          console.error("Failed to delete step image:", err);
        });
      }

      const updated = [...items];

      updated[stepIndex] = {
        ...updated[stepIndex],
        images: updated[stepIndex].images
          .filter((_, i) => i !== imageIndex)
          .map((img, i) => ({ ...img, order: i })),
      };
      setItems(updated);
      emitChanges(updated);
    },
    [items, emitChanges, deleteStepImage]
  );

  const handleFileSelect = (index: number) => {
    fileInputRefs.current[index]?.click();
  };

  const handleReorder = useCallback(
    (newOrder: StepItem[]) => {
      const normalized = normalizeStepItems(newOrder);

      setItems(normalized);
      emitChanges(normalized);
    },
    [emitChanges]
  );

  // Track step numbers excluding headings
  const getStepNumber = (index: number): number | null => {
    let stepNum = 0;

    for (let i = 0; i <= index; i++) {
      if (!items[i].text.trim().startsWith("#")) stepNum++;
    }
    const isHeading = items[index].text.trim().startsWith("#");

    return isHeading ? null : stepNum;
  };

  return (
    <Reorder.Group
      ref={dragConstraintsRef}
      axis="y"
      className="flex flex-col gap-3 md:gap-4"
      values={items}
      onReorder={handleReorder}
    >
      {items.map((item, index) => (
        <StepRow
          key={item.id}
          dragConstraintsRef={dragConstraintsRef}
          fileInputRefs={fileInputRefs}
          index={index}
          isLast={index === items.length - 1}
          item={item}
          recipeId={recipeId}
          showRemove={items.length > 1 && (!!item.text || item.images.length > 0)}
          stepNumber={getStepNumber(index)}
          uploadingIndex={uploadingIndex}
          onBlur={() => handleBlur(index)}
          onFileSelect={() => handleFileSelect(index)}
          onImageUpload={(file) => handleImageUpload(index, file)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onRemove={() => handleRemove(index)}
          onRemoveImage={(imgIndex) => handleRemoveImage(index, imgIndex)}
          onValueChange={(v) => handleInputChange(index, v)}
        />
      ))}
    </Reorder.Group>
  );
}

function normalizeStepItems(next: StepItem[]): StepItem[] {
  const withoutTrailingEmpty = next.filter(
    (it) => it.text.trim().length > 0 || (it.images && it.images.length > 0)
  );
  const normalized = [...withoutTrailingEmpty, createStepItem("", [])];

  return normalized.length ? normalized : [createStepItem("", [])];
}

// Separate component for each row to use useDragControls
interface StepRowProps {
  item: StepItem;
  index: number;
  stepNumber: number | null;
  isLast: boolean;
  showRemove: boolean;
  recipeId?: string;
  uploadingIndex: number | null;
  fileInputRefs: React.RefObject<(HTMLInputElement | null)[]>;
  dragConstraintsRef: React.RefObject<HTMLUListElement | null>;
  onValueChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
  onRemove: () => void;
  onImageUpload: (file: File) => void;
  onRemoveImage: (imageIndex: number) => void;
  onFileSelect: () => void;
}

function StepRow({
  item,
  index,
  stepNumber,
  isLast,
  showRemove,
  recipeId,
  uploadingIndex,
  fileInputRefs,
  dragConstraintsRef,
  onValueChange,
  onKeyDown,
  onBlur,
  onRemove,
  onImageUpload,
  onRemoveImage,
  onFileSelect,
}: StepRowProps) {
  const controls = useDragControls();
  const hasContent = !!item.text || item.images.length > 0;
  const canDrag = !isLast && hasContent;

  return (
    <Reorder.Item
      className="flex flex-col gap-2"
      drag={canDrag ? "y" : false}
      dragConstraints={dragConstraintsRef}
      dragControls={controls}
      dragElastic={0}
      dragListener={false}
      dragMomentum={false}
      style={{ position: "relative" }}
      value={item}
    >
      <div className="flex items-start gap-1 md:gap-2">
        {/* Drag handle - only show for non-empty, non-last items */}
        <div
          className={`flex h-10 w-5 flex-shrink-0 touch-none items-center justify-center md:w-6 ${
            !isLast && hasContent ? "cursor-grab active:cursor-grabbing" : ""
          }`}
          onPointerDown={(e) => {
            if (canDrag) {
              controls.start(e);
            }
          }}
        >
          {canDrag ? <Bars3Icon className="text-default-400 h-4 w-4" /> : null}
        </div>

        {/* Step number */}
        <div className="text-default-500 flex h-10 w-5 flex-shrink-0 items-center justify-center text-sm font-medium md:w-6 md:text-base">
          {stepNumber !== null ? `${stepNumber}.` : ""}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <SmartTextInput
            minRows={2}
            placeholder={
              index === 0 ? `Step ${index + 1}: Describe the step...` : `Step ${index + 1}`
            }
            value={item.text}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            onValueChange={onValueChange}
          />

          {/* Image thumbnails */}
          {item.images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.images.map((img, imgIndex) => (
                <div key={imgIndex} className="relative h-18 w-18 md:h-20 md:w-20">
                  <Image
                    alt={`Step ${index + 1} image ${imgIndex + 1}`}
                    className="h-14 w-14 rounded-lg object-cover md:h-16 md:w-16"
                    src={img.image}
                  />
                  <button
                    className="bg-danger hover:bg-danger-600 absolute top-0 right-0 z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-lg transition-colors"
                    type="button"
                    onClick={() => onRemoveImage(imgIndex)}
                  >
                    <XMarkIcon className="h-4 w-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons - stacked vertically */}
        <div className="mt-1 flex flex-shrink-0 flex-col gap-0.5">
          {/* Image upload button */}
          {recipeId && (
            <>
              <input
                ref={(el) => {
                  fileInputRefs.current[index] = el;
                }}
                accept="image/*"
                className="hidden"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];

                  if (file) {
                    onImageUpload(file);
                    e.target.value = "";
                  }
                }}
              />
              <Button
                isIconOnly
                isLoading={uploadingIndex === index}
                size="sm"
                variant="light"
                onPress={onFileSelect}
              >
                <PhotoIcon className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Remove button */}
          {showRemove && (
            <Button isIconOnly size="sm" variant="light" onPress={onRemove}>
              <XMarkIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Reorder.Item>
  );
}
