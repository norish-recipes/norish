"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRecipeAutocomplete } from "@/hooks/recipes";
import { Avatar, ListBox, Spinner, TextArea } from "@heroui/react";
import { useTranslations } from "next-intl";

export interface SmartTextInputIngredientSuggestion {
  key: string;
  label: string;
  /** The referenced ingredient line's order — what a mention attaches. */
  ingredientOrder: number;
}

/**
 * A name offered while plain text is typed, with no trigger character: picking
 * it rewrites part of the text (the caller says which) rather than inserting a
 * mention. Used by ingredient rows to offer known ingredient names (ADR-0037).
 */
export interface SmartTextInputNameSuggestion {
  key: string;
  label: string;
  detail?: string;
  imageUrl?: string | null;
  /** The text once this suggestion is picked, and where the caret goes. */
  apply: () => { value: string; caret: number };
}

interface SmartTextInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  ingredientSuggestions?: SmartTextInputIngredientSuggestion[];
  /**
   * The `@` mention gesture: picking a suggestion inserts the plain word into
   * the sentence and hands the caller both the updated text and the picked
   * line in one call, so the text change and the attachment land atomically.
   * The `@` itself never reaches the stored text. Returning true means the
   * caller takes focus (it is asking for the amount): the caret is still
   * placed after the inserted word, but without pulling focus back here.
   */
  onIngredientMention?: (
    suggestion: SmartTextInputIngredientSuggestion,
    newValue: string
  ) => boolean | void;
  /**
   * Names to offer for what has just been typed, with no trigger character.
   * Asked only as the user types — never on focus — and only when no `/` or
   * `@` suggestion is open. Arrow keys move through them, Enter picks the
   * highlighted one, and Enter with nothing highlighted is left to `onKeyDown`.
   */
  /** Trigger-less suggestions for the value itself, with the label its list is announced by. */
  nameSuggestions?: {
    label: string;
    get: (value: string) => SmartTextInputNameSuggestion[];
  };
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** Reaches the underlying textarea, for callers that manage row focus. */
  ref?: React.Ref<HTMLTextAreaElement>;
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
  onIngredientMention,
  nameSuggestions: nameSuggestionsSource,
  onBlur,
  onKeyDown,
  ref,
}: SmartTextInputProps) {
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>(null);
  const [nameSuggestions, setNameSuggestions] = useState<SmartTextInputNameSuggestion[]>([]);
  const [highlighted, setHighlighted] = useState(-1);
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
  const showNameSuggestions = !showAutocomplete && nameSuggestions.length > 0;

  const closeNameSuggestions = useCallback(() => {
    setNameSuggestions([]);
    setHighlighted(-1);
  }, []);

  useEffect(() => {
    if ((showAutocomplete || showNameSuggestions) && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 256;

      setOpenAbove(spaceBelow < dropdownHeight && rect.top > dropdownHeight);
    }
  }, [showAutocomplete, showNameSuggestions]);

  const handleChange = useCallback(
    (newValue: string) => {
      onValueChange(newValue);

      const cursorPos = textareaRef.current?.selectionStart ?? newValue.length;

      const recipeMatch = getRecipeTriggerMatch(newValue, cursorPos);
      const ingredientMatch = getIngredientTriggerMatch(newValue, cursorPos);

      if (nameSuggestionsSource && !recipeMatch && !ingredientMatch) {
        setNameSuggestions(nameSuggestionsSource.get(newValue));
        setHighlighted(-1);
      } else if (nameSuggestions.length > 0) {
        // Only when there is something to clear: every keystroke in every
        // SmartTextInput passes through here, suggestions or not.
        setNameSuggestions([]);
        setHighlighted(-1);
      }

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
    [nameSuggestionsSource, nameSuggestions.length, ingredientSuggestions.length, onValueChange]
  );

  const handleNameSuggestionSelect = useCallback(
    (suggestion: SmartTextInputNameSuggestion) => {
      const { value: newValue, caret } = suggestion.apply();

      onValueChange(newValue);
      closeNameSuggestions();

      setTimeout(() => {
        if (!textareaRef.current) return;

        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(caret, caret);
      }, 0);
    },
    [closeNameSuggestions, onValueChange]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (showNameSuggestions) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setHighlighted((current) => Math.min(nameSuggestions.length - 1, current + 1));

          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setHighlighted((current) => Math.max(-1, current - 1));

          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          closeNameSuggestions();

          return;
        }

        const picked = nameSuggestions[highlighted];

        if ((event.key === "Enter" || event.key === "Tab") && !event.shiftKey && picked) {
          event.preventDefault();
          handleNameSuggestionSelect(picked);

          return;
        }

        if (event.key === "Enter") closeNameSuggestions();
      }

      onKeyDown?.(event);
    },
    [
      closeNameSuggestions,
      handleNameSuggestionSelect,
      highlighted,
      nameSuggestions,
      onKeyDown,
      showNameSuggestions,
    ]
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

      // The mention gesture: the plain word goes into the sentence — the `@`
      // and the query it swallowed are replaced, never stored.
      const before = value.slice(0, autocomplete.triggerStart);
      const after = value.slice(autocomplete.cursorPosition);
      const newValue = `${before}${suggestion.label}${after}`;
      const newCursorPos = before.length + suggestion.label.length;

      // A handler returning true is taking focus — it opens the amount ask
      // for the attached line. The caret still lands after the inserted
      // word, ready for when focus comes back; it is just not fought over.
      let callerTakesFocus = false;

      if (onIngredientMention) {
        callerTakesFocus = onIngredientMention(suggestion, newValue) === true;
      } else {
        onValueChange(newValue);
      }

      setAutocomplete(null);

      setTimeout(() => {
        if (!textareaRef.current) return;

        if (!callerTakesFocus) textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    },
    [autocomplete, onIngredientMention, onValueChange, value]
  );

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      setAutocomplete(null);
      closeNameSuggestions();
    }, 200);
    onBlur?.();
  }, [closeNameSuggestions, onBlur]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAutocomplete(null);
        setNameSuggestions([]);
        setHighlighted(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const setTextareaRef = (element: HTMLTextAreaElement | null) => {
    textareaRef.current = element;
    if (typeof ref === "function") ref(element);
    else if (ref) ref.current = element;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <TextArea
        ref={setTextareaRef}
        className="border-border dark:border-border-tertiary w-full text-base"
        placeholder={placeholder}
        rows={minRows}
        value={value}
        onBlur={handleBlur}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {showNameSuggestions && (
        <ul
          aria-label={nameSuggestionsSource?.label}
          className={`bg-surface absolute right-0 left-0 z-50 max-h-64 overflow-auto rounded-xl p-1 shadow-lg ${
            openAbove ? "bottom-full mb-1" : "top-full mt-1"
          }`}
          data-testid="name-suggestions"
          role="listbox"
        >
          {nameSuggestions.map((suggestion, index) => (
            // Keyboard use stays in the textarea (arrows and Enter above), so the
            // option itself only answers the pointer.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={suggestion.key}
              aria-selected={index === highlighted}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 ${
                index === highlighted ? "bg-surface-secondary" : "hover:bg-surface-secondary"
              }`}
              data-testid="name-suggestion"
              role="option"
              // Keep the textarea focused: the pick happens on click.
              onClick={() => handleNameSuggestionSelect(suggestion)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlighted(index)}
            >
              {suggestion.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- immutable versioned URL
                <img
                  alt=""
                  className="size-7 shrink-0 rounded-md bg-white object-cover"
                  src={suggestion.imageUrl}
                />
              ) : (
                <span aria-hidden className="bg-surface-secondary size-7 shrink-0 rounded-md" />
              )}
              <span className="min-w-0 truncate text-sm font-medium">{suggestion.label}</span>
              {suggestion.detail && (
                <span className="text-muted min-w-0 truncate text-xs">{suggestion.detail}</span>
              )}
            </li>
          ))}
        </ul>
      )}

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
