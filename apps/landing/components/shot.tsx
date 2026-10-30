import { asset } from "@/lib/assets";

/**
 * Intrinsic size of the largest variant plus the widths that exist on disk.
 * Every picture is pre-rendered at these sizes under `public/screenshots/optimized`
 * (scripts/optimize-shots.mjs), so no image optimizer is involved.
 */
const SHOTS = {
  "recipe-mobile": { widths: [390, 780], width: 780, height: 1546 },
  "cooking-mobile": { widths: [390, 780], width: 780, height: 1546 },
  "calendar-mobile": { widths: [390, 780], width: 780, height: 1546 },
  "groceries-mobile": { widths: [390, 780], width: 780, height: 1546 },
  "pantry-mobile": { widths: [390, 780], width: 780, height: 1546 },
  "recipe-web": { widths: [800, 1600], width: 1600, height: 1182 },
  "nora-bench": { widths: [400, 800], width: 800, height: 1067 },
  "nora-snow": { widths: [400, 800], width: 800, height: 1067 },
  "nora-sunset": { widths: [400, 800], width: 800, height: 1067 },
} as const;

export type ShotName = keyof typeof SHOTS;

type ShotProps = {
  base: ShotName;
  alt: string;
  /** Rendered width hint for the browser's variant pick, e.g. "(min-width: 64rem) 20rem, 60vw". */
  sizes: string;
  className?: string;
  /** For pictures on the first screen. */
  eager?: boolean;
};

export function Shot({ base, alt, sizes, className, eager = false }: ShotProps) {
  const { widths, width, height } = SHOTS[base];

  return (
    <img
      alt={alt}
      className={className}
      decoding="async"
      height={height}
      loading={eager ? "eager" : "lazy"}
      sizes={sizes}
      src={asset(`/screenshots/optimized/${base}-${width}.webp`)}
      srcSet={widths
        .map((w) => `${asset(`/screenshots/optimized/${base}-${w}.webp`)} ${w}w`)
        .join(", ")}
      width={width}
    />
  );
}
