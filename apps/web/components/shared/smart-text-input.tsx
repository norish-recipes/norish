"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRecipeAutocomplete } from "@/hooks/recipes";
import { Avatar, ListBox, Spinner, TextArea } from "@heroui/react";
import { useTranslations } from "next-intl";

export interface SmartTextInputIngredientSuggestion {
  key: string;
  label: string;
  token: string;
}

interface SmartTextInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  ingredientSuggestions?: SmartTextInputIngredientSuggestion[];
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

type AutocompleteState =
  | {
      type: "recipe";
      query: string;
      triggerStart: number;
      cursorPosition: number;
    }
  | {
      type: "ingredient";
      query: string;
      triggerStart: number;
      cursorPosition: number;
    }
  | null;

export default function SmartTextInput({
  value,
  onValueChange,
  placeholder,
  minRows = 1,
  ingredientSuggestions = [],
  onBlur,
  onKeyDown,
}: SmartTextInputProps) {
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>(null);
  const [openAbove, setOpenAbove] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const t = useTranslations("recipes.empty");

  const recipeAutocompleteOpen = autocomplete?.type === "recipe";
  const autocompleteQuery = autocomplete?.query ?? "";
  const { suggestions, isLoading } = useRecipeAutocomplete(
    autocompleteQuery,
    recipeAutocompleteOpen
  );
  const ingredientMatches =
    autocomplete?.type === "ingredient"
      ? ingredientSuggestions
          .filter((suggestion) =>
            suggestion.label.toLowerCase().includes(autocomplete.query.trim().toLowerCase())
          )
          .slice(0, 8)
      : [];
  const showAutocomplete =
    autocomplete?.type === "recipe" ||
    (autocomplete?.type === "ingredient" && ingredientMatches.length > 0);

  useEffect(() => {
    if (showAutocomplete && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 256;

      setOpenAbove(spaceBelow < dropdownHeight && rect.top > dropdownHeight);
    }
  }, [showAutocomplete]);

  const handleChange = useCallback(
    (newValue: string) => {
      onValueChange(newValue);

      const cursorPos = textareaRef.current?.selectionStart ?? newValue.length;

      const recipeMatch = getRecipeTriggerMatch(newValue, cursorPos);
      const ingredientMatch = getIngredientTriggerMatch(newValue, cursorPos);

      if (
        ingredientMatch &&
        ingredientSuggestions.length > 0 &&
        (!recipeMatch || ingredientMatch.triggerStart > recipeMatch.triggerStart)
      ) {
        setAutocomplete({
          type: "ingredient",
          ...ingredientMatch,
        });

        return;
      }

      if (recipeMatch) {
        setAutocomplete({
          type: "recipe",
          ...recipeMatch,
        });

        return;
      }

      setAutocomplete(null);
    },
    [ingredientSuggestions.length, onValueChange]
  );

  const handleSelect = useCallback(
    (recipeId: string, recipeName: string) => {
      if (autocomplete?.type !== "recipe") return;

      const before = value.slice(0, autocomplete.triggerStart);
      const after = value.slice(autocomplete.cursorPosition);
      const newValue = `${before}[${recipeName}](id:${recipeId})${after}`;

      onValueChange(newValue);
      setAutocomplete(null);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newCursorPos = autocomplete.triggerStart + recipeName.length + recipeId.length + 7;

          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    },
    [autocomplete, value, onValueChange]
  );
  const handleIngredientSelect = useCallback(
    (suggestion: SmartTextInputIngredientSuggestion) => {
      if (autocomplete?.type !== "ingredient") return;

      const before = value.slice(0, autocomplete.triggerStart);
      const after = value.slice(autocomplete.cursorPosition);
      const newValue = `${before}${suggestion.token}${after}`;
      const newCursorPos = before.length + suggestion.token.length;

      onValueChange(newValue);
      setAutocomplete(null);

      setTimeout(() => {
        if (!textareaRef.current) return;

        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [autocomplete, onValueChange, value]
  );

  const handleBlur = useCallback(() => {
    setTimeout(() => setAutocomplete(null), 200);
    onBlur?.();
  }, [onBlur]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAutocomplete(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <TextArea
        ref={textareaRef}
        className="border-border dark:border-border-tertiary w-full text-base"
        placeholder={placeholder}
        rows={minRows}
        value={value}
        onBlur={handleBlur}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={onKeyDown}
      />

      {showAutocomplete && (
        <div
          className={`bg-surface absolute right-0 left-0 z-50 max-h-64 overflow-auto rounded-xl shadow-lg ${
            openAbove ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {autocomplete?.type === "recipe" && isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner size="sm" />
            </div>
          ) : autocomplete?.type === "recipe" && suggestions.length > 0 ? (
            <ListBox
              aria-label="Recipe suggestions"
              items={suggestions}
              onAction={(key) => {
                const recipe = suggestions.find((r) => r.id === key);

                if (recipe) handleSelect(recipe.id, recipe.name);
              }}
            >
              {(recipe) => (
                <ListBox.Item key={recipe.id} id={recipe.id} textValue={recipe.name}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-8 rounded-md">
                      {recipe.image ? (
                        <Avatar.Image alt="" className="object-cover" src={recipe.image} />
                      ) : null}
                      <Avatar.Fallback className="text-muted text-xs">R</Avatar.Fallback>
                    </Avatar>
                    <span className="truncate text-sm font-medium">{recipe.name}</span>
                  </div>
                </ListBox.Item>
              )}
            </ListBox>
          ) : autocomplete?.type === "ingredient" && ingredientMatches.length > 0 ? (
            <ListBox
              aria-label="Ingredient suggestions"
              items={ingredientMatches}
              onAction={(key) => {
                const suggestion = ingredientMatches.find((item) => item.key === key);

                if (suggestion) handleIngredientSelect(suggestion);
              }}
            >
              {(suggestion) => (
                <ListBox.Item key={suggestion.key} id={suggestion.key} textValue={suggestion.label}>
                  <span className="truncate text-sm font-medium">{suggestion.label}</span>
                </ListBox.Item>
              )}
            </ListBox>
          ) : autocomplete?.type === "recipe" && autocompleteQuery.length >= 1 ? (
            <div className="text-muted px-4 py-3 text-sm">{t("noResults")}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function getRecipeTriggerMatch(
  value: string,
  cursorPosition: number
): { query: string; triggerStart: number; cursorPosition: number } | null {
  const textBeforeCursor = value.slice(0, cursorPosition);
  const triggerStart = textBeforeCursor.lastIndexOf("/");

  if (triggerStart === -1) return null;

  const previousChar = triggerStart > 0 ? textBeforeCursor[triggerStart - 1] : " ";
  const isValidTrigger = previousChar === " " || previousChar === "\n" || triggerStart === 0;

  if (!isValidTrigger) return null;

  const query = textBeforeCursor.slice(triggerStart + 1);

  if (query.length < 1 || query.includes("\n")) return null;

  return {
    query,
    triggerStart,
    cursorPosition,
  };
}

function getIngredientTriggerMatch(
  value: string,
  cursorPosition: number
): { query: string; triggerStart: number; cursorPosition: number } | null {
  const textBeforeCursor = value.slice(0, cursorPosition);
  const triggerStart = textBeforeCursor.lastIndexOf("@");

  if (triggerStart === -1) return null;

  const previousChar = triggerStart > 0 ? textBeforeCursor[triggerStart - 1] : "";

  if (/[A-Za-z0-9_]/.test(previousChar)) return null;

  const query = textBeforeCursor.slice(triggerStart + 1);

  if (query.includes("\n") || query.includes("{") || query.includes("}")) return null;

  return {
    query,
    triggerStart,
    cursorPosition,
  };
}
