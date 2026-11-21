import { useCSSVariable } from "uniwind";

/** A theme token HeroUI's own list lacks (accent text, nutrition, cooking time), as a colour. */
export function useTokenColor(name: string): string | undefined {
  // The native stylesheet keeps the theme-scoped `--name`; Tailwind inlines `--color-name` away.
  const color = useCSSVariable(`--${name}`);

  return typeof color === "string" ? color : undefined;
}
