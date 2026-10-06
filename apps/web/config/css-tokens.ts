// The shared glass tokens are gone on purpose: Norish does not fake glass
// (ADR-0020), and their absence is the enforcement — with no token to reach
// for, re-adding blur means writing it out by hand, which the design
// invariants suite catches.

export const APP_MAIN_HORIZONTAL_PADDING_CLASS = "px-4 md:px-6";

/**
 * What the app shell keeps clear at the foot of every page: on a phone, the
 * nav pill's own height and offset plus a gap; on desktop, an ordinary margin.
 * `APP_MAIN_BOTTOM_PADDING_REM` is the phone figure, written out separately
 * because Tailwind reads class names from the source and never sees one a
 * template literal builds — keep the two in step.
 */
export const APP_MAIN_BOTTOM_PADDING_CLASS = "pb-20 md:pb-6";
export const APP_MAIN_BOTTOM_PADDING_REM = 5;

export const hoverInputIcon =
  "w-5 h-5 text-muted group-hover:text-foreground group-focus-within:text-accent transition-colors";

// A control sitting on real media is solid near-black: it carries its own
// contrast instead of borrowing whatever plays underneath (ADR-0020).
export const cssMediaControl = "bg-neutral-900 text-white hover:bg-neutral-800";

// The same control where the picture is the point and a filled disc would crowd
// it: the glyph alone, carrying its contrast in a shadow rather than a circle.
// Still a real object over the media, not a pane of glass — there is nothing to
// see through, because there is nothing there but the arrow.
export const cssMediaControlBare = [
  "border-none bg-transparent text-white shadow-none",
  "drop-shadow-[0_1px_4px_rgb(0_0_0/0.65)]",
  "hover:bg-transparent data-[hovered=true]:bg-transparent data-[pressed=true]:bg-transparent",
  "hover:opacity-80 data-[hovered=true]:opacity-80",
  "[&_svg]:size-7",
].join(" ");

// The soft accent halo behind an empty-state icon, drawn as a radial
// gradient rather than blur compositing (ADR-0020 removed blur outright).
export const cssEmptyStateGlow =
  "from-accent/20 dark:from-accent/15 absolute -inset-12 bg-radial-[closest-side] from-40% to-transparent";

export const cssInputNoHover =
  "hover:!bg-white/70 dark:hover:!bg-black/70 data-[hovered=true]:!bg-white/70 dark:data-[hovered=true]:!bg-black/70 focus:!bg-white/70 dark:focus:!bg-black/70 data-[focus=true]:!bg-white/70 dark:data-[focus=true]:!bg-black/70 active:!bg-white/70 dark:active:!bg-black/70 data-[pressed=true]:!bg-white/70 dark:data-[pressed=true]:!bg-black/70 hover:!opacity-100 data-[hovered=true]:!opacity-100 transition-none";

export const cssInputNoHoverTransparent =
  "hover:!bg-transparent dark:hover:!bg-transparent data-[hovered=true]:!bg-transparent dark:data-[hovered=true]:!bg-transparent focus:!bg-transparent dark:focus:!bg-transparent data-[focus=true]:!bg-transparent dark:data-[focus=true]:!bg-transparent active:!bg-transparent dark:active:!bg-transparent data-[pressed=true]:!bg-transparent dark:data-[pressed=true]:!bg-transparent hover:!opacity-100 data-[hovered=true]:!opacity-100 transition-none";

export const cssButtonPill =
  "rounded-full data-[hovered=true]:bg-surface-tertiary data-[pressed=true]:bg-surface-tertiary";

export const cssButtonPillDanger =
  "rounded-full text-danger data-[hovered=true]:bg-danger/10 data-[pressed=true]:bg-danger/15";

// Dropdown/Menu item pill styling to unify hover/pressed across menus
// Uses important overrides to beat component defaults and keeps base transparent
export const cssMenuItemPill =
  "rounded-full bg-transparent data-[hovered=true]:!bg-surface-tertiary data-[pressed=true]:!bg-surface-tertiary data-[focus=true]:!bg-surface-tertiary";

// AI gradient text styling for menu items and labels
export const cssAIGradientText =
  "bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent";

// AI gradient background for buttons
export const cssAIGradientBg =
  "bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 text-white";

// AI icon color
export const cssAIIconColor = "text-fuchsia-500";

// MobileNav hides by shrinking in place rather than sliding away, so a hidden
// nav never vacates the corner. Everything that floats above it — the timer
// dock, the cook pill — therefore shrinks with it rather than dropping to the
// floor and landing on top of it.
export const MOBILE_NAV_SHRUNKEN_SCALE = 0.8;

// The phone's floating layer sits above the nav pill: the timer dock in the
// right corner and the cook pill in the left read the same offsets, so they
// rise and fall with the nav together instead of drifting apart. Both offsets
// are measured from the nav's own anchor, which is what makes the shrunken
// pair scale about the same point and stay aligned.
const FLOATING_DOCK_ABOVE_NAV_REM = 3.75;

/**
 * The other station: a round control the size of the nav's own end cap — the
 * calendar's back-to-today button — stacks on the end of the bar rather than
 * standing in the pill row, so it sits closer than a pill does and reads as
 * part of the nav instead of as something hovering over it.
 */
const FLOATING_DOCK_STACKED_ABOVE_NAV_REM = 3.5;

const floatingDockBottom = (aboveNavRem: number) =>
  `calc(max(env(safe-area-inset-bottom), 1rem) + ${aboveNavRem}rem)`;

export const cssFloatingDockBottomWithNav = floatingDockBottom(FLOATING_DOCK_ABOVE_NAV_REM);
export const cssFloatingDockBottomWithShrunkenNav = floatingDockBottom(
  FLOATING_DOCK_ABOVE_NAV_REM * MOBILE_NAV_SHRUNKEN_SCALE
);
export const cssFloatingDockStackedBottomWithNav = floatingDockBottom(
  FLOATING_DOCK_STACKED_ABOVE_NAV_REM
);
export const cssFloatingDockStackedBottomWithShrunkenNav = floatingDockBottom(
  FLOATING_DOCK_STACKED_ABOVE_NAV_REM * MOBILE_NAV_SHRUNKEN_SCALE
);
export const cssFloatingDockBottomDesktop = "1rem";

// The cook pill, the add pill and the collapsed timer dock are the same object
// at different stations along the nav pill, so they are sized once here rather
// than three times by coincidence. The height is repeated as a number for the
// clearance below, for the same reason the shell's padding is.
const FLOATING_DOCK_PILL_HEIGHT_REM = 2.5;

export const cssFloatingDockPill = "h-10 min-h-10 rounded-full px-4";

/**
 * The nav's end cap, and anything that stacks on it: the user-menu circle and
 * the calendar's back-to-today button are the same disc at two heights, so a
 * column of them lines up on one centre without either side measuring the
 * other.
 */
export const cssFloatingDockEndCap = "h-12 w-12 rounded-full";

/**
 * What a page owes the dock row on top of the clearance the shell already
 * gives the nav: the row's offset above the nav, the pill standing in it, and
 * a gap — so the last thing on the page stops above the pill instead of
 * disappearing under its edge. Mobile only; on desktop nothing floats there.
 *
 * Read off the same figures the row is positioned by, because a page that
 * guesses its own number is a page that stops clearing the pill the moment the
 * row moves.
 */
export const cssFloatingDockContentClearance = `calc(max(env(safe-area-inset-bottom), 1rem) + ${
  FLOATING_DOCK_ABOVE_NAV_REM + FLOATING_DOCK_PILL_HEIGHT_REM + 1 - APP_MAIN_BOTTOM_PADDING_REM
}rem)`;
