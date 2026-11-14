import { useEffect, useId } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useIsFocused } from "expo-router";

import { useRecipePageStore } from "@norish/shared-react/recipes";

/** Keeps the screen awake while the reader asked for it and the page is in front; mounted once. */
export function ScreenKeepAwake() {
  const wanted = useRecipePageStore((state) => state.wakeLock !== "off");
  const focused = useIsFocused();
  // One tag per page: a recipe link stacks pages, and one's release must not cancel another's hold.
  const tag = useId();

  useEffect(() => {
    if (!wanted || !focused) return;

    void activateKeepAwakeAsync(tag);

    return () => void deactivateKeepAwake(tag);
  }, [wanted, focused, tag]);

  return null;
}
