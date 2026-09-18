"use client";

import { IngredientIllustration } from "@/components/recipes/ingredient-illustration";

/** One offered ingredient name: what is inserted, what it belongs to, and its picture. */
export interface NameSuggestion {
  key: string;
  label: string;
  imageUrl?: string | null;
}

interface NameSuggestionListProps {
  /** Ties the options to the field they belong to through `aria-activedescendant`. */
  id: string;
  label: string;
  suggestions: readonly NameSuggestion[];
  highlighted: number;
  onHighlight: (index: number) => void;
  onPick: (index: number) => void;
  /** Open upwards where the field sits near the bottom of the screen. */
  openAbove?: boolean;
}

/** The id of one option, which the field points at while the option is highlighted. */
export function nameSuggestionOptionId(listId: string, index: number): string {
  return `${listId}-option-${index}`;
}

/**
 * The names offered while an ingredient name is typed, wherever it is typed: a
 * recipe's ingredient line and the Pantry's field alike (ADR-0037). It draws
 * the list and nothing else — the field above it owns the value, the keys and
 * what picking means.
 */
export function NameSuggestionList({
  id,
  label,
  suggestions,
  highlighted,
  onHighlight,
  onPick,
  openAbove = false,
}: NameSuggestionListProps) {
  if (suggestions.length === 0) return null;

  return (
    <ul
      aria-label={label}
      className={`bg-surface absolute right-0 left-0 z-50 max-h-64 overflow-auto rounded-xl p-1 shadow-lg ${
        openAbove ? "bottom-full mb-1" : "top-full mt-1"
      }`}
      data-testid="name-suggestions"
      id={id}
      role="listbox"
    >
      {suggestions.map((suggestion, index) => (
        // Keyboard use stays in the field above, so the option only answers the
        // pointer.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events
        <li
          key={suggestion.key}
          aria-selected={index === highlighted}
          className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 ${
            index === highlighted ? "bg-surface-secondary" : "hover:bg-surface-secondary"
          }`}
          data-testid="name-suggestion"
          id={nameSuggestionOptionId(id, index)}
          role="option"
          // Keep the field focused: the pick happens on click.
          onClick={() => onPick(index)}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => onHighlight(index)}
        >
          <span className="bg-surface-secondary size-8 shrink-0 overflow-hidden rounded-md">
            <IngredientIllustration imageUrl={suggestion.imageUrl} size="sm" />
          </span>
          <span className="min-w-0 truncate text-sm font-medium">{suggestion.label}</span>
        </li>
      ))}
    </ul>
  );
}
