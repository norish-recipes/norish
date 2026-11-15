"use client";

import { useRef, useState } from "react";
import { useRecipeImages } from "@/features/recipes/hooks/use-recipe-images";
import { Bars3Icon, PhotoIcon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";

import type {
  IngredientSuggestion,
  LineMoves,
  Step,
  StepIngredientDraft,
  StepRow as StepItem,
} from "@norish/shared-react/recipes";
import type { MeasurementSystem } from "@norish/shared/contracts";
import {
  chipLinesOf,
  createStepRow,
  ingredientSuggestionsOf,
  isHeadingText,
  mentionIngredient,
  normalizeStepRows,
  removeStepRow,
  rowNumbers,
  seedStepRows,
  stepRowsToSteps,
  typeStepRow,
  withStepRefsOf,
} from "@norish/shared-react/recipes";
import { addBasePath } from "@norish/shared/lib/base-path";
import { createClientLogger } from "@norish/shared/lib/logger";

import SmartTextInput from "./smart-text-input";
import { StepIngredientChips } from "./step-ingredient-chips";

export type { Step } from "@norish/shared-react/recipes";

const log = createClientLogger("StepInput");

interface StepInputIngredient {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  systemUsed: MeasurementSystem;
  order: number;
}
interface StepInputProps {
  steps: Step[];
  onChange: (steps: Step[]) => void;
  systemUsed?: MeasurementSystem;
  recipeId?: string; // Required for image uploads
  ingredients?: StepInputIngredient[];
  /** The last move of the ingredient lines, which the steps' references follow. */
  lineMoves?: LineMoves | null;
}

export default function StepInput({
  steps,
  onChange,
  systemUsed = "metric",
  recipeId,
  ingredients = [],
  lineMoves = null,
}: StepInputProps) {
  const t = useTranslations("recipes.stepInput");
  const [items, setItems] = useState<StepItem[]>(() => seedStepRows(steps));
  const [seededLength, setSeededLength] = useState(steps.length);
  // A freshly mentioned line whose chip should ask for its amount: the row
  // it landed on, and the line's order for the chips to open once rendered.
  const [pendingMentionEntry, setPendingMentionEntry] = useState<{
    index: number;
    order: number;
  } | null>(null);
  const textareasRef = useRef<(HTMLTextAreaElement | null)[]>([]);
  const fileInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const dragConstraintsRef = useRef<HTMLUListElement>(null);
  const { uploadStepImage, deleteStepImage } = useRecipeImages();
  // Chips derive amounts, so they get the active system's lines only — an
  // entered "100" means 100 in the units the editor is looking at.
  const chipLines = chipLinesOf(ingredients, systemUsed);
  const ingredientSuggestions = ingredientSuggestionsOf(chipLines);

  // Seeds the editor once when the steps load; a later change to them must not
  // overwrite what is being typed.
  if (steps.length !== seededLength) {
    setSeededLength(steps.length);
    const first = items[0];

    if (
      first &&
      steps.length > 0 &&
      items.length === 1 &&
      first.text === "" &&
      first.images.length === 0
    ) {
      setItems(seedStepRows(steps));
    }
  }
  // The form moved the references; the rows take them from it once lines have moved.
  const [appliedMoves, setAppliedMoves] = useState(lineMoves);

  if (lineMoves !== appliedMoves) {
    setAppliedMoves(lineMoves);
    if (lineMoves) setItems(withStepRefsOf(items, steps));
  }
  const emitChanges = (updatedItems: StepItem[]) =>
    onChange(stepRowsToSteps(updatedItems, systemUsed));
  const handleStepIngredientsChange = (index: number, refs: StepIngredientDraft[]) => {
    const current = items[index];

    if (!current) return;
    const updated = [...items];

    updated[index] = {
      ...current,
      stepIngredients: refs,
    };
    setItems(updated);
    emitChanges(updated);
  };
  const handleIngredientMention = (
    index: number,
    suggestion: IngredientSuggestion,
    newText: string
  ): boolean => {
    // One update for both halves of the gesture: the word lands and its chip attaches.
    const { rows, asksAmount } = mentionIngredient(items, index, suggestion, newText, chipLines);

    if (rows === items) return false;
    setItems(rows);
    emitChanges(rows);
    // The chips take focus to ask the amount, so the mention reports that it gave focus up.
    if (asksAmount) setPendingMentionEntry({ index, order: suggestion.ingredientOrder });

    return asksAmount;
  };
  const handleInputChange = (index: number, value: string) => {
    const updated = typeStepRow(items, index, value);

    if (updated === items) return;
    setItems(updated);
    emitChanges(updated);
  };
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (index < items.length - 1) {
        textareasRef.current[index + 1]?.focus();
      } else {
        const updated = [...items, createStepRow("")];

        setItems(updated);
        setTimeout(() => {
          textareasRef.current[items.length]?.focus();
        }, 0);
      }
    } else if (e.key === "Backspace" && !items[index]?.text && index > 0) {
      e.preventDefault();
      const updated = items.filter((_, i) => i !== index);

      setItems(updated);
      emitChanges(updated);
      setTimeout(() => {
        textareasRef.current[index - 1]?.focus();
      }, 0);
    }
  };
  const handleBlur = (index: number) => {
    const item = items[index];

    // Auto-remove empty rows on blur (except the last one)
    if (item && !item.text.trim() && item.images.length === 0 && index < items.length - 1) {
      const updated = removeStepRow(items, index);

      setItems(updated);
      emitChanges(updated);
    }
  };
  const handleRemove = (index: number) => {
    // Delete all images for this step
    const stepImages = items[index]?.images ?? [];

    stepImages.forEach((img) => {
      deleteStepImage(img.image).catch((err: unknown) =>
        log.error({ err }, "Failed to delete step image")
      );
    });
    const updated = removeStepRow(items, index);

    setItems(updated);
    emitChanges(updated);
  };
  const handleImageUpload = async (index: number, file: File) => {
    const rowId = items[index]?.id;

    if (!recipeId || !rowId) return;
    setUploadingIndex(index);
    await uploadStepImage(file, recipeId)
      .then((result) => {
        const { url } = result;

        if (!result.success || !url) return;
        // The photo joins its row as the rows are now: they may have changed while uploading.
        setItems((current) => {
          const updated = current.map((item) =>
            item.id === rowId
              ? { ...item, images: [...item.images, { image: url, order: item.images.length }] }
              : item
          );

          emitChanges(updated);

          return updated;
        });
      })
      .finally(() => setUploadingIndex(null));
  };
  const handleRemoveImage = (stepIndex: number, imageIndex: number) => {
    const current = items[stepIndex];

    if (!current) return;
    const imageUrl = current.images[imageIndex]?.image;

    if (imageUrl) {
      deleteStepImage(imageUrl).catch((err: unknown) =>
        log.error({ err }, "Failed to delete step image")
      );
    }
    const updated = [...items];

    updated[stepIndex] = {
      ...current,
      images: current.images
        .filter((_, i) => i !== imageIndex)
        .map((img, i) => ({
          ...img,
          order: i,
        })),
    };
    setItems(updated);
    emitChanges(updated);
  };
  const handleFileSelect = (index: number) => {
    fileInputsRef.current[index]?.click();
  };
  const handleReorder = (newOrder: StepItem[]) => {
    const normalized = normalizeStepRows(newOrder);

    setItems(normalized);
    emitChanges(normalized);
  };
  const clearPendingMentionEntry = () => setPendingMentionEntry(null);

  // Steps are numbered past the section headings.
  const numbers = rowNumbers(items.map((item) => item.text));

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
          autoEntryOrder={pendingMentionEntry?.index === index ? pendingMentionEntry.order : null}
          dragConstraintsRef={dragConstraintsRef}
          fileInputsRef={fileInputsRef}
          index={index}
          ingredientSuggestions={ingredientSuggestions}
          ingredients={chipLines}
          textareasRef={textareasRef}
          isLast={index === items.length - 1}
          item={item}
          recipeId={recipeId}
          showRemove={items.length > 1 && (!!item.text || item.images.length > 0)}
          stepNumber={numbers[index] ?? null}
          stepPlaceholder={t("stepPlaceholder", {
            number: index + 1,
          })}
          stepPlaceholderShort={t("stepPlaceholderShort", {
            number: index + 1,
          })}
          uploadingIndex={uploadingIndex}
          onAutoEntryHandled={clearPendingMentionEntry}
          onBlur={() => handleBlur(index)}
          onFileSelect={() => handleFileSelect(index)}
          onImageUpload={(file) => handleImageUpload(index, file)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onRemove={() => handleRemove(index)}
          onIngredientMention={(suggestion, newText) =>
            handleIngredientMention(index, suggestion, newText)
          }
          onRemoveImage={(imgIndex) => handleRemoveImage(index, imgIndex)}
          onStepIngredientsChange={(refs) => handleStepIngredientsChange(index, refs)}
          onValueChange={(v) => handleInputChange(index, v)}
        />
      ))}
    </Reorder.Group>
  );
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
  fileInputsRef: React.RefObject<(HTMLInputElement | null)[]>;
  textareasRef: React.RefObject<(HTMLTextAreaElement | null)[]>;
  dragConstraintsRef: React.RefObject<HTMLUListElement | null>;
  stepPlaceholder: string;
  stepPlaceholderShort: string;
  ingredientSuggestions: IngredientSuggestion[];
  ingredients: StepInputIngredient[];
  autoEntryOrder: number | null;
  onAutoEntryHandled: () => void;
  onValueChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
  onRemove: () => void;
  onImageUpload: (file: File) => void;
  onRemoveImage: (imageIndex: number) => void;
  onFileSelect: () => void;
  onStepIngredientsChange: (refs: StepIngredientDraft[]) => void;
  onIngredientMention: (suggestion: IngredientSuggestion, newText: string) => boolean | void;
}
function StepRow({
  item,
  index,
  stepNumber,
  isLast,
  showRemove,
  recipeId,
  uploadingIndex,
  fileInputsRef,
  textareasRef,
  dragConstraintsRef,
  stepPlaceholder,
  stepPlaceholderShort,
  ingredientSuggestions,
  ingredients,
  autoEntryOrder,
  onAutoEntryHandled,
  onValueChange,
  onKeyDown,
  onBlur,
  onRemove,
  onImageUpload,
  onRemoveImage,
  onFileSelect,
  onStepIngredientsChange,
  onIngredientMention,
}: StepRowProps) {
  const controls = useDragControls();
  const hasContent = !!item.text || item.images.length > 0;
  const canDrag = !isLast && hasContent;
  // Heading rows cannot receive chips, and the trailing empty row has no step
  // for them to belong to yet.
  const canCarryStepIngredients = !!item.text.trim() && !isHeadingText(item.text);

  return (
    <Reorder.Item
      className="flex flex-col gap-2"
      drag={canDrag ? "y" : false}
      dragConstraints={dragConstraintsRef}
      dragControls={controls}
      dragElastic={0}
      dragListener={false}
      dragMomentum={false}
      style={{
        position: "relative",
      }}
      value={item}
    >
      <div className="flex items-start gap-1 md:gap-2">
        {/* Drag handle - only show for non-empty, non-last items */}
        <div
          className={`flex h-10 w-5 flex-shrink-0 touch-none items-center justify-center md:w-6 ${!isLast && hasContent ? "cursor-grab active:cursor-grabbing" : ""}`}
          onPointerDown={(e) => {
            if (canDrag) {
              controls.start(e);
            }
          }}
        >
          {canDrag ? <Bars3Icon className="text-muted h-4 w-4" /> : null}
        </div>

        {/* Step number */}
        <div className="text-muted flex h-10 w-5 flex-shrink-0 items-center justify-center text-sm font-medium md:w-6 md:text-base">
          {stepNumber !== null ? `${stepNumber}.` : ""}
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <SmartTextInput
            ref={(element) => {
              textareasRef.current[index] = element;
            }}
            ingredientSuggestions={ingredientSuggestions}
            minRows={2}
            placeholder={index === 0 ? stepPlaceholder : stepPlaceholderShort}
            value={item.text}
            onBlur={onBlur}
            onIngredientMention={onIngredientMention}
            onKeyDown={onKeyDown}
            onValueChange={onValueChange}
          />

          {canCarryStepIngredients && (
            <StepIngredientChips
              autoEntryOrder={autoEntryOrder}
              ingredients={ingredients}
              refs={item.stepIngredients}
              onAutoEntryHandled={onAutoEntryHandled}
              onChange={onStepIngredientsChange}
              onEntryKeyboardClose={() => textareasRef.current[index]?.focus()}
            />
          )}

          {/* Image thumbnails */}
          {item.images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.images.map((img, imgIndex) => (
                <div
                  // The same picture can sit here twice (uploads are named by content hash), so
                  // only its place tells the two apart; the list keeps its stored order.
                  // eslint-disable-next-line @eslint-react/no-array-index-key
                  key={imgIndex}
                  className="relative h-18 w-18 md:h-20 md:w-20"
                >
                  <img
                    alt={`Step ${index + 1}, attachment ${imgIndex + 1}`}
                    className="h-14 w-14 rounded-lg object-cover md:h-16 md:w-16"
                    src={addBasePath(img.image)}
                  />
                  <button
                    className="bg-danger hover:bg-danger/90 absolute top-0 right-0 z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-lg transition-colors"
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
                  fileInputsRef.current[index] = el;
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
                isPending={uploadingIndex === index}
                size="sm"
                variant="tertiary"
                onPress={onFileSelect}
              >
                <PhotoIcon className="h-4 w-4" />
              </Button>
            </>
          )}

          {/* Remove button */}
          {showRemove && (
            <Button isIconOnly size="sm" variant="tertiary" onPress={onRemove}>
              <XMarkIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Reorder.Item>
  );
}
