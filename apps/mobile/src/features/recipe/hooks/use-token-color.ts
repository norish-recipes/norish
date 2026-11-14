import { useCSSVariable } from "uniwind";

/** A theme token HeroUI's own list lacks (nutrition, cooking time, accent text), as a colour. */
export function useTokenColor(name: string): string | undefined {
  const [asColor, raw] = useCSSVariable([`--color-${name}`, `--${name}`]);

  return [asColor, raw].find((value): value is string => typeof value === "string");
}
