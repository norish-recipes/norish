import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { Link } from "expo-router";

type Href = ComponentProps<typeof Link>["href"];

export type MenuItem = {
  key: string;
  label: string;
  /** An SF Symbol. */
  icon: ComponentProps<typeof Link.MenuAction>["icon"];
  destructive?: boolean;
  onPress: () => void;
};

/**
 * The card's long-press menu: iOS's own context menu lifting the card, over a plain scrim.
 * The link only hosts the menu (its child takes no press), so the card's own gestures open it.
 */
export function CardMenu({
  href,
  items,
  children,
}: {
  href: Href;
  items: MenuItem[];
  children: ReactNode;
}) {
  return (
    <Link asChild href={href}>
      <Link.Trigger>{children}</Link.Trigger>
      <Link.Menu>
        {items.map(({ key, label, icon, destructive, onPress }) => (
          <Link.MenuAction key={key} destructive={destructive} icon={icon} onPress={onPress}>
            {label}
          </Link.MenuAction>
        ))}
      </Link.Menu>
    </Link>
  );
}
