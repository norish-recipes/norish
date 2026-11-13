import type { PlatformStorage } from "@norish/shared-react/platform";

/** localStorage, read as empty while the server renders. Typed synchronous, which localStorage is. */
export const browserStorage = {
  getItem: (key) => (typeof window === "undefined" ? null : window.localStorage.getItem(key)),
  setItem: (key, value) => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  },
} satisfies PlatformStorage;
