"use client";

import type { ComponentPropsWithoutRef, ComponentType, ReactNode, SVGProps } from "react";
import { Accordion, Card } from "@heroui/react";
import { twMerge } from "tailwind-merge";

interface SettingsCardProps extends Omit<ComponentPropsWithoutRef<typeof Card>, "title"> {
  /** The outline icon that names the card at a glance. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: ReactNode;
  /** One short line under the title. */
  description?: ReactNode;
  /** Chips beside the title: requires restart, a status, ... */
  badges?: ReactNode;
  /** Buttons at the end of the header; they wrap under the title on a phone. */
  actions?: ReactNode;
  /** A card whose whole subject is destructive, like deleting the account. */
  danger?: boolean;
  contentClassName?: string;
  children?: ReactNode;
}

/**
 * One settings card: an icon and a title, the line that says what the card is
 * for, and its content. Every card on every settings tab is one of these, so
 * the header, the description and the spacing under them cannot drift apart.
 */
export function SettingsCard({
  icon: Icon,
  title,
  description,
  badges,
  actions,
  danger = false,
  contentClassName,
  children,
  ...cardProps
}: SettingsCardProps) {
  return (
    <Card {...cardProps}>
      <Card.Header className="flex-row flex-wrap items-center gap-x-2 gap-y-3">
        <h2
          className={twMerge(
            "flex items-center gap-2 text-lg font-semibold",
            danger && "text-danger"
          )}
        >
          <Icon aria-hidden className="size-5 shrink-0" />
          {title}
        </h2>
        {badges}
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:ms-auto">{actions}</div>
        ) : null}
      </Card.Header>
      <Card.Content className={twMerge("gap-4", contentClassName)}>
        {description ? <p className="text-muted text-base">{description}</p> : null}
        {children}
      </Card.Content>
    </Card>
  );
}

/**
 * The sections a settings card folds away, as one bordered list: the same
 * grouped rows as the Ingredients list, edge to edge with the card's content,
 * each row's name as large as a setting's.
 */
export function SettingsAccordion({ children }: { children: ReactNode }) {
  return (
    <Accordion
      allowsMultipleExpanded
      className="border-border overflow-hidden rounded-xl border [&_[data-slot=accordion-trigger]]:text-base"
    >
      {children}
    </Accordion>
  );
}
