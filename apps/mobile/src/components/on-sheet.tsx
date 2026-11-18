import { createContext, useContext } from "react";

/** `Sheet` sets it, so what renders inside knows its grouped content is the translucent fill. */
export const OnSheet = createContext(false);

export const useOnSheet = () => useContext(OnSheet);

/** A grouped row's ground: the translucent fill on a sheet, solid off one. */
export const useGroupedFill = () => (useOnSheet() ? "bg-fill" : "bg-default");
