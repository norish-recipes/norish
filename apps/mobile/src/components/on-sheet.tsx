import { createContext, useContext } from "react";

/** `Sheet` sets it, so what renders inside knows its grouped content sits on sand. */
export const OnSheet = createContext(false);

export const useOnSheet = () => useContext(OnSheet);

/** A grouped row's ground: sand on a sheet, the page's default off one. */
export const useGroupedFill = () => (useOnSheet() ? "bg-sand" : "bg-default");
