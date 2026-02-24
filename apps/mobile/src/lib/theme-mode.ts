export type ThemeMode = "light" | "dark";

export const nextTheme = (theme: ThemeMode): ThemeMode => {
  return theme === "light" ? "dark" : "light";
};
