import type { StoreColor } from "@/types";

// Store color configuration with Tailwind classes
export const STORE_COLORS: Record<
  StoreColor,
  {
    bg: string;
    bgLight: string;
    text: string;
    border: string;
    ring: string;
    label: string;
  }
> = {
  primary: {
    bg: "bg-primary",
    bgLight: "bg-primary/10",
    text: "text-primary",
    border: "border-primary",
    ring: "ring-primary",
    label: "Blue",
  },
  secondary: {
    bg: "bg-secondary",
    bgLight: "bg-secondary/10",
    text: "text-secondary",
    border: "border-secondary",
    ring: "ring-secondary",
    label: "Purple",
  },
  success: {
    bg: "bg-success",
    bgLight: "bg-success/10",
    text: "text-success",
    border: "border-success",
    ring: "ring-success",
    label: "Green",
  },
  warning: {
    bg: "bg-warning",
    bgLight: "bg-warning/10",
    text: "text-warning",
    border: "border-warning",
    ring: "ring-warning",
    label: "Yellow",
  },
  danger: {
    bg: "bg-danger",
    bgLight: "bg-danger/10",
    text: "text-danger",
    border: "border-danger",
    ring: "ring-danger",
    label: "Red",
  },
  slate: {
    bg: "bg-slate-500",
    bgLight: "bg-slate-500/10",
    text: "text-slate-500",
    border: "border-slate-500",
    ring: "ring-slate-500",
    label: "Gray",
  },
  sky: {
    bg: "bg-sky-500",
    bgLight: "bg-sky-500/10",
    text: "text-sky-500",
    border: "border-sky-500",
    ring: "ring-sky-500",
    label: "Light Blue",
  },
  violet: {
    bg: "bg-violet-500",
    bgLight: "bg-violet-500/10",
    text: "text-violet-500",
    border: "border-violet-500",
    ring: "ring-violet-500",
    label: "Violet",
  },
};

// All available store colors for the picker
export const STORE_COLOR_OPTIONS: StoreColor[] = [
  "primary",
  "secondary",
  "success",
  "warning",
  "danger",
  "slate",
  "sky",
  "violet",
];

export function getStoreColorClasses(color: StoreColor) {
  return STORE_COLORS[color] ?? STORE_COLORS.primary;
}
