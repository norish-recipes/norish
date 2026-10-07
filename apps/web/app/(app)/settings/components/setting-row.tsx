"use client";

import type { ReactNode } from "react";

interface SettingRowBaseProps {
  /** What the setting is called. */
  title: ReactNode;
  /** What it does, in a sentence. Rendered full width on a phone. */
  description?: ReactNode;
  /** Chips that qualify the title: unsaved changes, requires restart, ... */
  badges?: ReactNode;
  /** The control this row exists to offer. */
  children: ReactNode;
}

/**
 * One setting: a name, a sentence about it, and the control that changes it.
 *
 * A settings row is two columns of very different appetite — prose that wants
 * the whole line and a control that wants a fixed one — and on a phone there
 * is only room for one of them at a time. Putting them side by side anyway is
 * what shredded these cards into columns two words wide, so below `sm` the
 * control moves under the text and takes the full width; from `sm` up the row
 * reads exactly as it always has.
 *
 * From `sm` up the control's column is one fixed width on every settings card,
 * so no select is squeezed by a long description and none grows or shrinks as
 * the window does. A select fills it (`w-full`); a control that does not fill
 * the line sits at the end of it, the way every Save button in these cards
 * already does.
 */
export function SettingRow({ title, description, badges, children }: SettingRowBaseProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-foreground flex flex-wrap items-center gap-2 text-base font-medium">
          {title}
          {badges}
        </span>
        {description ? <span className="text-muted text-base">{description}</span> : null}
      </div>
      <div className="flex w-full justify-end sm:w-72 sm:shrink-0">{children}</div>
    </div>
  );
}

/**
 * A setting whose control is small enough to stay beside its title.
 *
 * A switch never needs a line of its own, so it keeps the top-right corner at
 * every width and only the description moves: beside the switch it was being
 * squeezed into the leftover column and running underneath it, so on a phone
 * it drops to its own full-width line below. From `sm` up the switch centres
 * against the whole block, which is where it has always been.
 */
export function SwitchRow({ title, description, badges, children }: SettingRowBaseProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
      <span className="text-foreground col-start-1 row-start-1 flex flex-wrap items-center gap-2 text-base font-medium">
        {title}
        {badges}
      </span>
      <div className="col-start-2 row-start-1 justify-self-end sm:row-span-2">{children}</div>
      {description ? (
        <span className="text-muted col-span-2 row-start-2 text-base sm:col-span-1 sm:col-start-1">
          {description}
        </span>
      ) : null}
    </div>
  );
}
