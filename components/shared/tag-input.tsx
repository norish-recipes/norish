"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/16/solid";

import { useTagsQuery } from "@/hooks/config";

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function TagInput({
  value,
  onChange,
  placeholder = "Type tags separated by spaces...",
  className = "",
}: TagInputProps) {
  const [rawInput, setRawInput] = useState("");
  const { tags: allTags } = useTagsQuery();
  const inputRef = useRef<HTMLInputElement>(null);

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

        // Skip if already seen, selected, or is exact match
        if (seenTags.has(tl)) return;
        if (value.some((sel) => sel.toLowerCase() === tl)) return;
        if (tl === lower) return; // Exact matches don't go in suggestions

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
        } else if (suggestions.length > 0 && currentWord.trim()) {
          // Auto-select first suggestion when pressing space
          e.preventDefault();
          handleAddTag(suggestions[0], true);
        }
      } else if (e.key === "Backspace" && !rawInput && value.length > 0) {
        e.preventDefault();
        handleRemoveTag(value[value.length - 1]);
      }
    },
    [exactMatch, handleAddTag, rawInput, value, handleRemoveTag, currentWord, suggestions]
  );

  return (
    <div className={className}>
      {/* Input area with inline tags */}
      <div className="group bg-default-100 hover:bg-default-200 transition-background data-[focus=true]:bg-default-100 flex min-h-[48px] flex-wrap items-center gap-2 rounded-xl px-3 py-2">
        <AnimatePresence mode="popLayout">
          {/* Selected tags */}
          {value.map((tag) => {
            return (
              <motion.button
                key={`selected-${tag}`}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                exit={{ opacity: 0, scale: 0.8 }}
                initial={{ opacity: 0, scale: 0.8 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 35,
                  mass: 0.5,
                }}
                type="button"
                onClick={() => handleRemoveTag(tag)}
              >
                {tag}
                <XMarkIcon className="h-3 w-3" />
              </motion.button>
            );
          })}
        </AnimatePresence>

        <input
          ref={inputRef}
          className="text-small text-default-foreground placeholder:text-default-500 min-w-[120px] flex-1 border-none bg-transparent outline-none"
          placeholder={value.length === 0 && typedWords.length === 0 ? placeholder : ""}
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
              const isExact = exactMatch && lower === exactMatch.toLowerCase();
              const isInSuggestions = suggestions.some((s) => s.toLowerCase().includes(lower));

              // Don't show if it's an exact match (already shown inline) or if it's in suggestions
              if (isExact || isInSuggestions) return null;

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
    </div>
  );
}
