import { createContext } from "react";

/** Reports a popup opening in the content, so the pill floating over it lets taps through. */
export const PopupOpenContext = createContext<((open: boolean) => void) | null>(null);
