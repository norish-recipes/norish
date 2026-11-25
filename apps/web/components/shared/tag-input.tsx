"use client";

import React, { useRef, useState } from "react";
import EditTagPanel from "@/components/Panel/consumers/edit-tag-panel";
import { SortableTagChips } from "@/components/shared/sortable-tag-chips";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import { useTagsQuery } from "@norish/shared-react/config";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Free-typed names kept as chips, split on spaces, with the household's Tags as suggestions: for
 * what is a plain name, such as the account's allergies. The recipe editor picks from its list
 * with `TagPicker` instead, which creates an entry only through its "Create" row.
 */
export default function TagInput({ value, onChange, placeholder, className = "" }: TagInputProps) {
  const t = useTranslations("common.tagInput");
  const [rawInput, setRawInput] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const { tags: allTags } = useTagsQuery();
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultPlaceholder = placeholder ?? t("placeholder");
  const selected = (tag: string) => value.some((v) => v.toLowerCase() === tag.toLowerCase());

  // Parse all typed words (not just the current one)
  const trimmedInput = rawInput.trim();
  const typedWords = trimmedInput
    ? [...new Set(trimmedInput.split(/\s+/).filter((w) => w.length >= 2))]
    : [];
  // The word being typed is the last one.
  const currentWord = trimmedInput ? (trimmedInput.split(/\s+/).at(-1) ?? "") : "";
  const exactMatch =
    currentWord.length >= 2
      ? (allTags.find((tag) => tag.toLowerCase() === currentWord.toLowerCase() && !selected(tag)) ??
        null)
      : null;

  // Every non-selected Tag containing a typed word, those starting with it first.
  const suggestions = (() => {
    const results: { t: string; score: number }[] = [];
    const seenTags = new Set<string>();

    typedWords.forEach((word) => {
      const lower = word.toLowerCase();

      allTags.forEach((tag) => {
        const tl = tag.toLowerCase();

        if (seenTags.has(tl) || selected(tag) || !tl.includes(lower)) return;

        const base = tl.startsWith(lower) ? 1 : 2;

        results.push({ t: tag, score: base * 10 + Math.abs(tag.length - lower.length) });
        seenTags.add(tl);
      });
    });

    return results
      .sort((a, b) => a.score - b.score || a.t.localeCompare(b.t))
      .map((r) => r.t)
      .slice(0, 8);
  })();

  const handleRemoveTag = (tag: string) => {
    onChange(value.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
  };

  // Clicking a suggested tag removes the matching text from the input.
  const handleAddTag = (tag: string, clearInput = true) => {
    if (selected(tag)) return;

    if (clearInput && rawInput) {
      const tagLower = tag.toLowerCase();
      const kept = rawInput
        .trim()
        .split(/\s+/)
        .filter((word) => !tagLower.includes(word.toLowerCase()));

      setRawInput(kept.join(" ").trim());
    } else {
      setRawInput("");
    }

    onChange([...value, tag]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === " ") {
      const lower = currentWord.toLowerCase();

      if (lower && selected(lower)) {
        // The word is selected already: drop it from the input.
        e.preventDefault();
        const kept = rawInput
          .trim()
          .split(/\s+/)
          .filter((word) => word.toLowerCase() !== lower);

        setRawInput(kept.join(" ").trim());
        inputRef.current?.focus();
      } else if (exactMatch) {
        e.preventDefault();
        handleAddTag(exactMatch, false);
      } else if (currentWord.trim() && currentWord.length >= 2) {
        e.preventDefault();
        handleAddTag(currentWord.trim(), false);
      }
    } else if (e.key === "Backspace" && !rawInput) {
      const last = value.at(-1);

      if (!last) return;
      e.preventDefault();
      handleRemoveTag(last);
    }
  };

  return (
    <div className={className}>
      {/* Input area with inline tags */}
      {/* A field holding chips is still a field: it takes the same soft
          secondary fill and border as every other input on the form — the
          plain field fill is pure white and would vanish against the card. */}
      <div className="group bg-default flex min-h-[48px] flex-wrap items-center gap-2 rounded-2xl border border-(--field-border) px-3 py-2 shadow-none">
        <SortableTagChips value={value} onActivate={setEditingTag} onChange={onChange}>
          <input
            ref={inputRef}
            className="text-foreground placeholder:text-muted min-w-[120px] flex-1 border-none bg-transparent text-sm outline-none"
            placeholder={value.length === 0 && typedWords.length === 0 ? defaultPlaceholder : ""}
            style={{ fontSize: "16px" }}
            type="text"
            value={rawInput}
            onBlur={(e) => e.currentTarget.parentElement?.removeAttribute("data-focus")}
            onChange={(e) => setRawInput(e.target.value)}
            onFocus={(e) => e.currentTarget.parentElement?.setAttribute("data-focus", "true")}
            onKeyDown={handleKeyDown}
          />
        </SortableTagChips>
      </div>

      {/* Non-matching words and suggestions below (matching RecurrenceSuggestion styling) */}
      {(typedWords.length > 0 || suggestions.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {/* Non-matching typed words (potential new tags) */}
            {typedWords.map((word) => {
              const lower = word.toLowerCase();
              // Only hide if it's an EXACT match with a suggestion (avoid true duplicates)
              const isExactMatch = suggestions.some((s) => s.toLowerCase() === lower);

              // Don't show if it's an exact match in suggestions (avoid duplicates)
              if (isExactMatch) return null;

              return (
                <motion.button
                  key={`new-tag-${word}`}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  className="bg-surface text-muted border-border inline-flex items-center rounded-full border-2 border-dashed px-2.5 py-1 text-xs font-medium opacity-70 transition-opacity hover:opacity-100"
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
                className="bg-surface text-muted border-border inline-flex items-center rounded-full border-2 border-dashed px-2.5 py-1 text-xs font-medium opacity-70 transition-opacity hover:opacity-100"
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
