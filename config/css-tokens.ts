// TODO: Figure out what tokens are actually used. Remove unused ones.

export const cssGlassBackdrop = "dark:bg-black/70 bg-white/70 backdrop-blur-sm";

export const APP_MAIN_HORIZONTAL_PADDING_CLASS = "px-4 md:px-6";

export const cssGlassBackdropChip = "bg-black/45 backdrop-blur-sm";

export const hoverInputIcon =
  "w-5 h-5 text-default-500 group-hover:text-foreground group-focus-within:text-primary transition-colors";

export const cssGlassBackdropPanel = "dark:bg-black/75 bg-white/80 backdrop-blur-sm";

export const cssGlassBackdropShadow = "shadow-[0_12px_36px_-12px_rgba(0,0,0,0.45)]";

export const cssInputNoHover =
  "hover:!bg-white/70 dark:hover:!bg-black/70 data-[hover=true]:!bg-white/70 dark:data-[hover=true]:!bg-black/70 focus:!bg-white/70 dark:focus:!bg-black/70 data-[focus=true]:!bg-white/70 dark:data-[focus=true]:!bg-black/70 active:!bg-white/70 dark:active:!bg-black/70 data-[pressed=true]:!bg-white/70 dark:data-[pressed=true]:!bg-black/70 hover:!opacity-100 data-[hover=true]:!opacity-100 transition-none";

export const cssInputNoHoverTransparent =
  "hover:!bg-transparent dark:hover:!bg-transparent data-[hover=true]:!bg-transparent dark:data-[hover=true]:!bg-transparent focus:!bg-transparent dark:focus:!bg-transparent data-[focus=true]:!bg-transparent dark:data-[focus=true]:!bg-transparent active:!bg-transparent dark:active:!bg-transparent data-[pressed=true]:!bg-transparent dark:data-[pressed=true]:!bg-transparent hover:!opacity-100 data-[hover=true]:!opacity-100 transition-none";

export const cssButtonPill =
  "rounded-full data-[hover=true]:bg-default-200 data-[pressed=true]:bg-default-300";

export const cssButtonPillDanger =
  "rounded-full text-danger-500 data-[hover=true]:bg-danger-100 data-[pressed=true]:bg-danger-200";

// Dropdown/Menu item pill styling to unify hover/pressed across menus
// Uses important overrides to beat component defaults and keeps base transparent
export const cssMenuItemPill =
  "rounded-full bg-transparent data-[hover=true]:!bg-default-200 data-[pressed=true]:!bg-default-300 data-[focus=true]:!bg-default-200";

// AI gradient text styling for menu items and labels
export const cssAIGradientText =
  "bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent";

// AI gradient background for buttons
export const cssAIGradientBg =
  "bg-gradient-to-r from-rose-400 via-fuchsia-500 to-indigo-500 text-white";

// AI icon color
export const cssAIIconColor = "text-fuchsia-500";
