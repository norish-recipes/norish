import { asset } from "@/lib/assets";

/**
 * Intrinsic size of the largest variant plus the widths that exist on disk.
 * Every picture is pre-rendered at these sizes under `public/screenshots/optimized`
 * (scripts/optimize-shots.mjs), so no image optimizer is involved. Captures of
 * the app come in both themes; photos in one.
 */
const SHOTS = {
  "recipe-mobile": { widths: [390, 780], width: 780, height: 1546, themed: true },
  "cooking-mobile": { widths: [390, 780], width: 780, height: 1546, themed: true },
  "calendar-mobile": { widths: [390, 780], width: 780, height: 1546, themed: true },
  "groceries-mobile": { widths: [390, 780], width: 780, height: 1546, themed: true },
  "pantry-mobile": { widths: [390, 780], width: 780, height: 1546, themed: true },
  "recipe-web": { widths: [800, 1600], width: 1600, height: 1182, themed: true },
  "nora-bench": { widths: [400, 800], width: 800, height: 1067, themed: false },
  "nora-snow": { widths: [400, 800], width: 800, height: 1067, themed: false },
  "nora-sunset": { widths: [400, 800], width: 800, height: 1067, themed: false },
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

function file(name: string, width: number) {
  return asset(`/screenshots/optimized/${name}-${width}.webp`);
}

/**
 * A picture at the widths on disk. A capture renders both theme variants and
 * swaps them with CSS, so the right one is on screen before first paint; the
 * hidden one is `display: none`, so a lazy loader never fetches it.
 */
export function Shot({ base, alt, sizes, className = "", eager = false }: ShotProps) {
  const { widths, width, height, themed } = SHOTS[base];
  const variant = (name: string, visibility: string) => (
    <img
      key={name}
      alt={alt}
      className={`${visibility} ${className}`}
      decoding="async"
      height={height}
      loading={eager ? "eager" : "lazy"}
      sizes={sizes}
      src={file(name, width)}
      srcSet={widths.map((w) => `${file(name, w)} ${w}w`).join(", ")}
      width={width}
    />
  );

  if (!themed) return variant(base, "");

  return (
    <>
      {variant(`${base}-light`, "dark:hidden")}
      {variant(`${base}-dark`, "hidden dark:block")}
    </>
  );
}
