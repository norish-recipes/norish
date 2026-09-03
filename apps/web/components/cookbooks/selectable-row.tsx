"use client";

import type { ComponentProps, ReactNode } from "react";
import { GroceryCheckbox, isCheckboxEvent } from "@/components/groceries/grocery-checkbox";

type SelectableRowProps = Omit<ComponentProps<"div">, "children" | "onClick" | "role"> & {
  isSelected: boolean;
  onToggle: () => void;
  /** The thumbnail: a cookbook's derived cover, or a recipe's picture. */
  media: ReactNode;
  title: string;
  subtitle?: string;
};

/**
 * One thing in a cookbook panel, in or out.
 *
 * Every list in this feature asks the same question — is this in the cookbook
 * or not — so they all ask it the same way, with the same control the
 * groceries panel ticks its items with. It is named for groceries because that
 * is where it was written; it is the app's round select box, and a second one
 * drawn by hand here was the reason ticking a cookbook and ticking a grocery
 * animated differently.
 *
 * The whole row is the target, so the checkbox has to be told apart from it or
 * a tap on the control would toggle twice — once from the control, once from
 * the row it sits in.
 *
 * Nothing here commits anything. Every panel that uses it applies on Save.
 */
export function SelectableRow({
  isSelected,
  onToggle,
  media,
  title,
  subtitle,
  ...props
}: SelectableRowProps) {
  const toggleFromRow = (event: { target: EventTarget | null }) => {
    if (!isCheckboxEvent(event)) onToggle();
  };

  return (
    <div
      {...props}
      aria-pressed={isSelected}
      className="hover:bg-surface-secondary flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors"
      role="button"
      tabIndex={0}
      onClick={toggleFromRow}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggleFromRow(event);
      }}
    >
      <span className="bg-surface-secondary text-muted flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
        {media}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold">{title}</span>
        {subtitle && <span className="text-muted truncate text-xs">{subtitle}</span>}
      </span>

      <GroceryCheckbox
        aria-label={title}
        className="shrink-0"
        isSelected={isSelected}
        size="md"
        onChange={onToggle}
      />
    </div>
  );
}
