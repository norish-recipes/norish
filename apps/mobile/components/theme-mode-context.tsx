import { createContext, type ReactNode, useContext } from "react";

export type ThemeMode = "system" | "light" | "dark";

type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (nextMode: ThemeMode) => void;
  resolvedMode: Exclude<ThemeMode, "system">;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function ThemeModeProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: ThemeModeContextValue;
}) {
  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeModeContext);

  if (!context) {
    throw new Error("useThemeMode must be used inside ThemeModeProvider");
  }

  return context;
}
