import { useCSSVariable } from "uniwind";

/** A theme token HeroUI's own list lacks (accent text, nutrition, cooking time), as a colour. */
export function useTokenColor(name: string): string | undefined {
  const color = useCSSVariable(`--color-${name}`);

  return typeof color === "string" ? color : undefined;
}
