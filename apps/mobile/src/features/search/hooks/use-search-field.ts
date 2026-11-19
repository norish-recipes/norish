import type { RefObject } from "react";
import type { SearchBarCommands } from "react-native-screens";
import { useEffect, useRef, useState } from "react";

import { useLibraryFilters, useLibraryFiltersStoreApi } from "@norish/shared-react/recipes";

import type { FieldEvent, FieldState } from "../utils/search-field";
import { fieldStep, FRESH_FIELD } from "../utils/search-field";

function pushKeptText(
  store: ReturnType<typeof useLibraryFiltersStoreApi>,
  barRef: RefObject<SearchBarCommands | null>
) {
  const kept = store.getState().filters.rawInput;

  if (kept) barRef.current?.setText(kept);
}

type NativeText = { nativeEvent: { text: string } };

/** Wires the header search field to Search's text: the decisions are `fieldStep`'s, this hands it the
 * native events and the kept state. */
export function useSearchField() {
  const store = useLibraryFiltersStoreApi();
  const text = useLibraryFilters((state) => state.filters.rawInput);
  const barRef = useRef<SearchBarCommands | null>(null);
  const timingRef = useRef<Pick<FieldState, "cancelledAt">>(FRESH_FIELD);
  const [focused, setFocused] = useState(false);

  // A remount, or coming back to the tab, leaves the native field empty over the kept text.
  const showKeptText = () => pushKeptText(store, barRef);

  useEffect(() => pushKeptText(store, barRef), [store]);

  const send = (event: FieldEvent) => {
    const { filters, searchConfirmed, setFilters, setSearchConfirmed } = store.getState();
    const { state, push } = fieldStep(
      { ...timingRef.current, text: filters.rawInput, confirmed: searchConfirmed },
      event,
      Date.now()
    );

    timingRef.current = state;

    if (state.text !== filters.rawInput) setFilters({ rawInput: state.text });

    setSearchConfirmed(state.confirmed);

    if (push !== undefined) barRef.current?.setText(push);
  };

  const field = {
    text,
    focused,
    onChangeText: ({ nativeEvent }: NativeText) => send({ type: "typed", text: nativeEvent.text }),
    onSearchButtonPress: ({ nativeEvent }: NativeText) =>
      send({ type: "submitted", text: nativeEvent.text }),
    onCancelButtonPress: () => {
      send({ type: "cancelled" });
      barRef.current?.blur();
    },
    // The search tab's × closes the field and leaves the tab, wiping the text first.
    onClose: () => send({ type: "cancelled" }),
    onOpen: showKeptText,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };

  return [barRef, field] as const;
}
