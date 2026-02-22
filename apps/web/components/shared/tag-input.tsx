"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "motion/react";

import { useTagsQuery } from "@/hooks/config";
import EditTagPanel from "@/components/Panel/consumers/edit-tag-panel";

interface SortableTagItemProps {
  tag: string;
  onEdit: (tag: string) => void;
}

function SortableTagItem({ tag, onEdit }: SortableTagItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tag,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex cursor-grab touch-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors active:cursor-grabbing"
      style={style}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onEdit(tag);
      }}
      onPointerDown={(_e) => {
        // Allow drag to start, but also allow click
        // The PointerSensor distance constraint handles this
      }}
      {...attributes}
      {...listeners}
    >
      <span>{tag}</span>
    </button>
  );
}

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function TagInput({ value, onChange, placeholder, className = "" }: TagInputProps) {
  const t = useTranslations("common.tagInput");
  const [rawInput, setRawInput] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const { tags: allTags } = useTagsQuery();
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultPlaceholder = placeholder ?? t("placeholder");

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

  // Handle drag start to track active item for overlay
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Handle drag end to reorder tags
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);

      if (over && active.id !== over.id) {
        const oldIndex = value.indexOf(active.id as string);
        const newIndex = value.indexOf(over.id as string);

        onChange(arrayMove(value, oldIndex, newIndex));
      }
    },
    [value, onChange]
  );

  // Parse all typed words (not just the current one)
  const typedWords = useMemo(() => {
    const trimmed = rawInput.trim();

    if (!trimmed) return [];

    return trimmed.split(/\s+/).filter((w) => w.length >= 2);
  }, [rawInput]);

  // Get the current word being typed (last word)
  const currentWord = useMemo(() => {
    const trimmed = rawInput.trim();

    if (!trimmed) return "";
    const words = trimmed.split(/\s+/);

    return words[words.length - 1];
  }, [rawInput]);

  // Find exact match for current word (for auto-select on space)
  const exactMatch = useMemo(() => {
    const lower = currentWord.toLowerCase();

    if (!lower || lower.length < 2) return null;

    const match = allTags.find((tag) => {
      const tagLower = tag.toLowerCase();

      return tagLower === lower && !value.some((v) => v.toLowerCase() === tagLower);
    });

    return match || null;
  }, [currentWord, allTags, value]);

  // Get all non-exact match suggestions to show below input
  const suggestions = useMemo(() => {
    if (typedWords.length === 0) return [];

    const results: { t: string; score: number }[] = [];
    const seenTags = new Set<string>();

    typedWords.forEach((word) => {
      const lower = word.toLowerCase();

      allTags.forEach((tag) => {
        const tl = tag.toLowerCase();

        // Skip if already seen or selected
        if (seenTags.has(tl)) return;
        if (value.some((sel) => sel.toLowerCase() === tl)) return;

        // Must contain the word
        if (!tl.includes(lower)) return;

        let base = 2;

        if (tl.startsWith(lower)) base = 1;

        const score = base * 10 + Math.abs(tag.length - lower.length);

        results.push({ t: tag, score });
        seenTags.add(tl);
      });
    });

    return results
      .sort((a, b) => a.score - b.score || a.t.localeCompare(b.t))
      .map((r) => r.t)
      .slice(0, 8);
  }, [typedWords, allTags, value]);

  // Handle removing a selected tag
  const handleRemoveTag = useCallback(
    (tag: string) => {
      onChange(value.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
    },
    [value, onChange]
  );

  // Handle clicking a suggested tag - removes matching text from input
  const handleAddTag = useCallback(
    (tag: string, clearInput = true) => {
      if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        return;
      }

      // When clicking a suggestion, remove the matching word from input
      if (clearInput && rawInput) {
        const words = rawInput.trim().split(/\s+/);
        const tagLower = tag.toLowerCase();
        const filteredWords = words.filter((word) => !tagLower.includes(word.toLowerCase()));

        setRawInput(filteredWords.join(" ").trim());
      } else {
        setRawInput("");
      }

      onChange([...value, tag]);
      inputRef.current?.focus();
    },
    [value, onChange, rawInput]
  );

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === " ") {
        const lower = currentWord.toLowerCase();

        // Check if current word matches an already selected tag
        if (lower && value.some((t) => t.toLowerCase() === lower)) {
          e.preventDefault();
          // Remove the word from input since it's already selected
          const words = rawInput.trim().split(/\s+/);
          const filteredWords = words.filter((word) => word.toLowerCase() !== lower);

          setRawInput(filteredWords.join(" ").trim());
          inputRef.current?.focus();
        } else if (exactMatch) {
          e.preventDefault();
          handleAddTag(exactMatch, false); // Don't try to remove text for exact matches
        } else if (currentWord.trim() && currentWord.length >= 2) {
          e.preventDefault();
          handleAddTag(currentWord.trim(), false);
        }
      } else if (e.key === "Backspace" && !rawInput && value.length > 0) {
        e.preventDefault();
        handleRemoveTag(value[value.length - 1]);
      }
    },
    [exactMatch, handleAddTag, rawInput, value, handleRemoveTag, currentWord]
  );

  return (
    <div className={className}>
      {/* Input area with inline tags */}
      <div className="group bg-default-100 hover:bg-default-200 transition-background data-[focus=true]:bg-default-100 flex min-h-[48px] flex-wrap items-center gap-2 rounded-xl px-3 py-2">
        <DndContext
          collisionDetection={closestCenter}
          sensors={sensors}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
        >
          <SortableContext items={value} strategy={horizontalListSortingStrategy}>
            {/* Selected tags - sortable */}
            {value.map((tag) => (
              <SortableTagItem key={tag} tag={tag} onEdit={setEditingTag} />
            ))}
          </SortableContext>

          {/* Drag overlay - shows the tag following the cursor */}
          <DragOverlay>
            {activeId ? (
              <div className="bg-primary/20 text-primary inline-flex cursor-grabbing items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg">
                <span>{activeId}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <input
          ref={inputRef}
          className="text-small text-default-foreground placeholder:text-default-500 min-w-[120px] flex-1 border-none bg-transparent outline-none"
          placeholder={value.length === 0 && typedWords.length === 0 ? defaultPlaceholder : ""}
          style={{ fontSize: "16px" }}
          type="text"
          value={rawInput}
          onBlur={(e) => e.currentTarget.parentElement?.removeAttribute("data-focus")}
          onChange={(e) => setRawInput(e.target.value)}
          onFocus={(e) => e.currentTarget.parentElement?.setAttribute("data-focus", "true")}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Non-matching words and suggestions below (matching RecurrenceSuggestion styling) */}
      {(typedWords.length > 0 || suggestions.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {/* Non-matching typed words (potential new tags) */}
            {typedWords.map((word, idx) => {
              const lower = word.toLowerCase();
              // Only hide if it's an EXACT match with a suggestion (avoid true duplicates)
              const isExactMatch = suggestions.some((s) => s.toLowerCase() === lower);

              // Don't show if it's an exact match in suggestions (avoid duplicates)
              if (isExactMatch) return null;

              return (
                <motion.button
                  key={`new-tag-${word}-${idx}`}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  className="bg-default-100 text-default-600 dark:bg-default-50 dark:text-default-700 border-default-300 inline-flex items-center rounded-full border-2 border-dashed px-2.5 py-1 text-xs font-medium opacity-70 transition-opacity hover:opacity-100"
                  exit={{ opacity: 0, scale: 0.9, x: -10 }}
                  initial={{ opacity: 0, scale: 0.9, x: -10 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  type="button"
                  onClick={() => handleAddTag(word)}
                >
                  {word}
                </motion.button>
              );
            })}

            {/* Existing tag suggestions */}
            {suggestions.map((tag) => (
              <motion.button
                key={`suggestion-${tag}`}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                className="bg-default-100 text-default-600 dark:bg-default-50 dark:text-default-700 border-default-300 inline-flex items-center rounded-full border-2 border-dashed px-2.5 py-1 text-xs font-medium opacity-70 transition-opacity hover:opacity-100"
                exit={{ opacity: 0, scale: 0.9, x: -10 }}
                initial={{ opacity: 0, scale: 0.9, x: -10 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                type="button"
                onClick={() => handleAddTag(tag)}
              >
                {tag}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Edit Tag Panel */}
      {editingTag && (
        <EditTagPanel
          existingTags={value}
          open={!!editingTag}
          tag={editingTag}
          onDelete={() => {
            handleRemoveTag(editingTag);
            setEditingTag(null);
          }}
          onOpenChange={(open) => !open && setEditingTag(null)}
          onSave={(newName) => {
            // Replace the old tag with the new name in the value array
            const index = value.findIndex((t) => t.toLowerCase() === editingTag.toLowerCase());

            if (index !== -1) {
              const newValue = [...value];

              newValue[index] = newName;
              onChange(newValue);
            }
            setEditingTag(null);
          }}
        />
      )}
    </div>
  );
}
