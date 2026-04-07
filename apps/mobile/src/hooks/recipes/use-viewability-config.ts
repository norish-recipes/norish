import type { ViewabilityConfig, ViewToken } from "react-native";
import { useRef } from "react";

/**
 * A stable `viewabilityConfig` for use with `FlatList`.
 * Items are considered viewable once 50 % of their area is on screen.
 */
export const viewabilityConfig: ViewabilityConfig = {
  itemVisiblePercentThreshold: 50,
};

type OnViewableItemsChanged = (info: { viewableItems: ViewToken[]; changed: ViewToken[] }) => void;

/**
 * Returns a stable `useRef`-based `onViewableItemsChanged` callback
 * suitable for passing to a `FlatList`.
 *
 * React Native requires that the `onViewableItemsChanged` prop does not
 * change during the lifetime of the list. Wrapping the actual handler in
 * a ref lets us update the implementation without triggering a warning.
 */
export function useViewableItemsRef(handler: OnViewableItemsChanged) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const stableRef = useRef<OnViewableItemsChanged>((info) => {
    handlerRef.current(info);
  });

  return stableRef;
}
