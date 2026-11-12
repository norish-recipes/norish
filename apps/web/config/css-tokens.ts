// No glass tokens on purpose (ADR-0020): blur must be written by hand, which
// the design invariants suite catches.

export const APP_MAIN_HORIZONTAL_PADDING_CLASS = "px-4 md:px-6";

/** A box that lays out like the main column it sits in, so wrapping a page in it moves nothing. */
export const APP_PAGE_COLUMN_CLASS = "flex min-h-0 flex-1 flex-col";

// The shell's foot clearance; the REM is the phone figure as a number, since
// Tailwind never sees a class a template literal builds. Keep the two in step.
export const APP_MAIN_BOTTOM_PADDING_CLASS = "pb-20 md:pb-6";
const APP_MAIN_BOTTOM_PADDING_REM = 5;

// A control sitting on real media is solid near-black: it carries its own
// contrast instead of borrowing whatever plays underneath (ADR-0020).
export const cssMediaControl = "bg-neutral-900 text-white hover:bg-neutral-800";

// The same control as a bare glyph where a disc would crowd the picture: its
// contrast comes from a drop shadow.
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

export const cssButtonPill =
  "rounded-full data-[hovered=true]:bg-surface-tertiary data-[pressed=true]:bg-surface-tertiary";

export const cssButtonPillDanger =
  "rounded-full text-danger data-[hovered=true]:bg-danger/10 data-[pressed=true]:bg-danger/15";

// A page header's controls share one height (28px, 32px from `sm`); a switch's
// tab is that height less the list's 2px rim.
export const cssHeaderControl = "h-7 min-w-7 text-xs sm:h-8 sm:min-w-8 sm:text-sm";
export const cssHeaderIconControl = "size-7 min-w-7 sm:size-8 sm:min-w-8";
export const cssHeaderTab = "h-6 px-2 text-xs sm:h-7 sm:min-w-16 sm:px-2.5";
export const cssHeaderIcon = "size-4 shrink-0";

// AI gradient text styling for menu items and labels
export const cssAIGradientText =
  "bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent";

// AI icon color
export const cssAIIconColor = "text-fuchsia-500";

// MobileNav hides by shrinking in place, so what floats above it (timer dock,
// cook pill) shrinks with it by this scale.
export const MOBILE_NAV_SHRUNKEN_SCALE = 0.8;

// The phone's floating row above the nav pill; offsets are measured from the
// nav's anchor so the shrunken pair scales about the same point.
const FLOATING_DOCK_ABOVE_NAV_REM = 3.75;

/** A round end-cap-sized control (calendar's back-to-today) stacked on the bar's end. */
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

// One size for the cook pill, add pill and collapsed timer dock; the height is
// repeated as a number for the clearance below.
const FLOATING_DOCK_PILL_HEIGHT_REM = 2.5;

export const cssFloatingDockPill = "h-10 min-h-10 rounded-full px-4";

/** The nav's end cap and what stacks on it, so the column lines up on one centre. */
export const cssFloatingDockEndCap = "h-12 w-12 rounded-full";

// The extra phone clearance a page owes the dock row beyond the shell's, read
// off the figures that position the row.
export const cssFloatingDockContentClearance = `calc(max(env(safe-area-inset-bottom), 1rem) + ${
  FLOATING_DOCK_ABOVE_NAV_REM + FLOATING_DOCK_PILL_HEIGHT_REM + 1 - APP_MAIN_BOTTOM_PADDING_REM
}rem)`;
