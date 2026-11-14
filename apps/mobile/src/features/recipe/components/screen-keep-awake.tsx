import { useEffect } from "react";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useIsFocused } from "expo-router";

import { useRecipePageStore } from "@norish/shared-react/recipes";

const TAG = "recipe-page";

/** Keeps the screen awake while the reader asked for it and the page is in front; mounted once. */
export function ScreenKeepAwake() {
  const wanted = useRecipePageStore((state) => state.wakeLock !== "off");
  const focused = useIsFocused();

  useEffect(() => {
    if (!wanted || !focused) return;

    void activateKeepAwakeAsync(TAG);

    return () => void deactivateKeepAwake(TAG);
  }, [wanted, focused]);

  return null;
}
