import type { SearchBarCommands } from "react-native-screens";
import { useEffect, useRef, useState } from "react";

import { useLibraryFilters, useLibraryFiltersStoreApi } from "@norish/shared-react/recipes";

import { setSearchConfirmed } from "../utils/search-session";
import { hasSearchFilters } from "../utils/search-state";

// UIKit empties the field on Cancel just before it reports it, as it does on the clear button.
const CANCEL_AFTER_CLEAR_MS = 300;

/** Wires the header search field to Search's text: typing edits it, the search key confirms, × dismisses
 * the keyboard and keeps everything, ⊗ clears the text. */
export function useSearchField() {
  const store = useLibraryFiltersStoreApi();
  const text = useLibraryFilters((state) => state.filters.rawInput);
  const barRef = useRef<SearchBarCommands | null>(null);
  const clearedRef = useRef<{ text: string; at: number } | null>(null);
  const [focused, setFocused] = useState(false);

  // A remount leaves the native field empty over the kept text.
  useEffect(() => {
    if (store.getState().filters.rawInput)
      barRef.current?.setText(store.getState().filters.rawInput);
  }, [store]);

  const setText = (next: string) => {
    const { filters, setFilters } = store.getState();

    if (next === filters.rawInput) return;

    clearedRef.current = next === "" ? { text: filters.rawInput, at: Date.now() } : null;
    setFilters({ rawInput: next });
    // Typing edits a confirmed search back into a question; chips keep their results when ⊗ clears the text.
    setSearchConfirmed(next === "" && hasSearchFilters(store.getState().filters));
  };

  const field = {
    text,
    focused,
    onChangeText: (event: { nativeEvent: { text: string } }) => setText(event.nativeEvent.text),
    onSearchButtonPress: (event: { nativeEvent: { text: string } }) => {
      setText(event.nativeEvent.text);

      if (event.nativeEvent.text.trim() !== "") setSearchConfirmed(true);
    },
    onCancelButtonPress: () => {
      const wiped = clearedRef.current;

      if (wiped && Date.now() - wiped.at < CANCEL_AFTER_CLEAR_MS) {
        setText(wiped.text);
        barRef.current?.setText(wiped.text);
      }

      barRef.current?.blur();
    },
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };

  return [barRef, field] as const;
}
