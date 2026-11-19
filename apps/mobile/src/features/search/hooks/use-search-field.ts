import type { SearchBarCommands } from "react-native-screens";
import { useEffect, useRef, useState } from "react";
import { isSearchConfirmed, setSearchConfirmed } from "@/lib/search-session";

import { useLibraryFilters, useLibraryFiltersStoreApi } from "@norish/shared-react/recipes";

import { hasSearchFilters } from "../utils/search-state";

// UIKit empties the field on Cancel next to its event, in either order, as it does on the clear button.
const CANCEL_AFTER_CLEAR_MS = 300;

/** Wires the header search field to Search's text: typing edits it, the search key confirms, × dismisses
 * the keyboard and keeps everything, ⊗ clears the text. */
export function useSearchField() {
  const store = useLibraryFiltersStoreApi();
  const text = useLibraryFilters((state) => state.filters.rawInput);
  const barRef = useRef<SearchBarCommands | null>(null);
  const cancelledAtRef = useRef(0);
  const clearedRef = useRef<{ text: string; confirmed: boolean; at: number } | null>(null);
  const [focused, setFocused] = useState(false);

  // A remount leaves the native field empty over the kept text.
  useEffect(() => {
    if (store.getState().filters.rawInput)
      barRef.current?.setText(store.getState().filters.rawInput);
  }, [store]);

  const setText = (next: string) => {
    const { filters, setFilters } = store.getState();

    if (next === filters.rawInput) return;

    // The empty text that follows a Cancel is UIKit's, not the reader's.
    if (next === "" && Date.now() - cancelledAtRef.current < CANCEL_AFTER_CLEAR_MS) {
      barRef.current?.setText(filters.rawInput);

      return;
    }

    clearedRef.current =
      next === ""
        ? { text: filters.rawInput, confirmed: isSearchConfirmed(), at: Date.now() }
        : null;
    setFilters({ rawInput: next });
    // Typing edits a confirmed search back into a question; chips keep their results when ⊗ clears the text.
    setSearchConfirmed(next === "" && hasSearchFilters(store.getState().filters));
  };

  const restoreWipedText = () => {
    cancelledAtRef.current = Date.now();

    const wiped = clearedRef.current;

    if (!wiped || Date.now() - wiped.at >= CANCEL_AFTER_CLEAR_MS) return;

    setText(wiped.text);
    setSearchConfirmed(wiped.confirmed);
    barRef.current?.setText(wiped.text);
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
      restoreWipedText();
      barRef.current?.blur();
    },
    // The search tab's × closes the field and leaves the tab, wiping the text first.
    onClose: restoreWipedText,
    // Coming back, the native field is empty over the kept text.
    onOpen: () => {
      const kept = store.getState().filters.rawInput;

      if (kept) barRef.current?.setText(kept);
    },
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };

  return [barRef, field] as const;
}
