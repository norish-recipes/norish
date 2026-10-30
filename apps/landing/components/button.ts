/** The page's pill buttons, as class names for an `<a>` or a `<button>`. */
const base =
  "inline-flex min-h-13 cursor-pointer items-center gap-2 rounded-full px-6 text-base font-semibold transition-[background-color,color,scale] active:scale-97 motion-reduce:transition-none motion-reduce:active:scale-100 [&>svg]:size-4.5";

export const button = {
  primary: `${base} bg-accent text-accent-foreground hover:bg-accent-deep`,
  secondary: `${base} bg-surface text-foreground ring-border hover:bg-surface-secondary ring-1`,
  /** On the green self-host band. */
  onAccent: `${base} bg-paper text-accent hover:bg-paper/85`,
  onAccentQuiet: `${base} bg-accent-deep text-accent-foreground hover:bg-foreground hover:text-background`,
};
