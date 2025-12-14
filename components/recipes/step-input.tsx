"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Textarea, Button, Image } from "@heroui/react";
import { XMarkIcon, PhotoIcon } from "@heroicons/react/16/solid";

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

export default function StepInput({
  steps,
  onChange,
  systemUsed = "metric",
  recipeId,
}: StepInputProps) {
  const [inputs, setInputs] = useState<{ text: string; images: StepImage[] }[]>([
    { text: "", images: [] },
  ]);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const { uploadStepImage, deleteStepImage } = useRecipeImages();

  // Initialize from steps prop
  useEffect(() => {
    if (steps.length > 0 && inputs.length === 1 && inputs[0].text === "" && inputs[0].images.length === 0) {
      setInputs([
        ...steps.map((s) => ({
          text: s.step,
          images: s.images || [],
        })),
        { text: "", images: [] },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  const emitChanges = useCallback(
    (updated: { text: string; images: StepImage[] }[]) => {
      const parsed = updated
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
      const updated = [...inputs];
      updated[index] = { ...updated[index], text: value };

      // Auto-add empty line at the end
      if (index === inputs.length - 1 && value.trim()) {
        updated.push({ text: "", images: [] });
      }

      setInputs(updated);
      emitChanges(updated);
    },
    [inputs, emitChanges]
  );

  const handleKeyDown = useCallback(
    (index: number, e: any) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (index < inputs.length - 1) {
          textareaRefs.current[index + 1]?.focus();
        } else {
          const updated = [...inputs, { text: "", images: [] }];
          setInputs(updated);
          setTimeout(() => {
            textareaRefs.current[inputs.length]?.focus();
          }, 0);
        }
      } else if (e.key === "Backspace" && !inputs[index].text && index > 0) {
        e.preventDefault();
        const updated = inputs.filter((_, i) => i !== index);
        setInputs(updated);
        emitChanges(updated);
        setTimeout(() => {
          textareaRefs.current[index - 1]?.focus();
        }, 0);
      }
    },
    [inputs, emitChanges]
  );

  const handleBlur = useCallback(
    (index: number) => {
      // Auto-remove empty rows on blur (except the last one)
      if (!inputs[index].text.trim() && inputs[index].images.length === 0 && index < inputs.length - 1) {
        const updated = inputs.filter((_, i) => i !== index);
        if (updated.length === 0) updated.push({ text: "", images: [] });
        setInputs(updated);
        emitChanges(updated);
      }
    },
    [inputs, emitChanges]
  );

  const handleRemove = useCallback(
    (index: number) => {
      // Delete all images for this step
      const stepImages = inputs[index].images;
      stepImages.forEach((img) => {
        deleteStepImage(img.image).catch((err) => {
          console.error("Failed to delete step image:", err);
        });
      });

      const updated = inputs.filter((_, i) => i !== index);
      if (updated.length === 0) updated.push({ text: "", images: [] });
      setInputs(updated);
      emitChanges(updated);
    },
    [inputs, emitChanges, deleteStepImage]
  );

  const handleImageUpload = useCallback(
    async (index: number, file: File) => {
      if (!recipeId) return;

      setUploadingIndex(index);

      try {
        const result = await uploadStepImage(file, recipeId);

        if (result.success && result.url) {
          const updated = [...inputs];
          const newImage: StepImage = {
            image: result.url,
            order: updated[index].images.length,
          };
          updated[index] = {
            ...updated[index],
            images: [...updated[index].images, newImage],
          };
          setInputs(updated);
          emitChanges(updated);
        }
      } finally {
        setUploadingIndex(null);
      }
    },
    [recipeId, inputs, emitChanges, uploadStepImage]
  );

  const handleRemoveImage = useCallback(
    (stepIndex: number, imageIndex: number) => {
      const imageUrl = inputs[stepIndex].images[imageIndex]?.image;
      if (imageUrl) {
        deleteStepImage(imageUrl).catch((err) => {
          console.error("Failed to delete step image:", err);
        });
      }

      const updated = [...inputs];
      updated[stepIndex] = {
        ...updated[stepIndex],
        images: updated[stepIndex].images
          .filter((_, i) => i !== imageIndex)
          .map((img, i) => ({ ...img, order: i })),
      };
      setInputs(updated);
      emitChanges(updated);
    },
    [inputs, emitChanges, deleteStepImage]
  );

  const handleFileSelect = (index: number) => {
    fileInputRefs.current[index]?.click();
  };

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      {inputs.map((item, index) => (
        <div key={index} className="flex flex-col gap-2">
          <div className="flex items-start gap-1 md:gap-2">
            {/* Step number */}
            <div className="text-default-500 flex h-10 w-6 flex-shrink-0 items-center justify-center text-sm font-medium md:w-8 md:text-base">
              {index + 1}.
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Textarea
                ref={(el) => {
                  textareaRefs.current[index] = el;
                }}
                classNames={{
                  input: "text-base",
                  inputWrapper: "border-default-200 dark:border-default-800",
                }}
                minRows={2}
                placeholder={index === 0 ? `Step ${index + 1}: Describe the step...` : `Step ${index + 1}`}
                value={item.text}
                onBlur={() => handleBlur(index)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onValueChange={(v) => handleInputChange(index, v)}
              />

              {/* Image thumbnails */}
              {item.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.images.map((img, imgIndex) => (
                    <div
                      key={imgIndex}
                      className="relative h-18 w-18 md:h-20 md:w-20"
                    >
                      <Image
                        alt={`Step ${index + 1} image ${imgIndex + 1}`}
                        className="h-14 w-14 rounded-lg object-cover md:h-16 md:w-16"
                        src={img.image}
                      />
                      <button
                        className="bg-danger hover:bg-danger-600 absolute top-0 right-0 z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-lg transition-colors"
                        type="button"
                        onClick={() => handleRemoveImage(index, imgIndex)}
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
                        handleImageUpload(index, file);
                        e.target.value = "";
                      }
                    }}
                  />
                  <Button
                    isIconOnly
                    isLoading={uploadingIndex === index}
                    size="sm"
                    variant="light"
                    onPress={() => handleFileSelect(index)}
                  >
                    <PhotoIcon className="h-4 w-4" />
                  </Button>
                </>
              )}

              {/* Remove button */}
              {inputs.length > 1 && (item.text || item.images.length > 0) && (
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => handleRemove(index)}
                >
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
