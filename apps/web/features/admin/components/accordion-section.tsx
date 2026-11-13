"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Accordion } from "@heroui/react";

import { UnsavedChangesChip } from "./unsaved-changes-chip";

/**
 * One section of a card's accordion: its title, subtitle and badges, and the unsaved-changes chip
 * while the form it holds reports edits through the `onDirtyChange` it is handed.
 */
export function AccordionSection({
  id,
  title,
  subtitle,
  badges,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  badges?: ReactNode;
  children: ReactNode | ((onDirtyChange: (isDirty: boolean) => void) => ReactNode);
}) {
  const [isDirty, setIsDirty] = useState(false);

  return (
    <Accordion.Item id={id}>
      <Accordion.Heading>
        <Accordion.Trigger>
          <div className="flex min-w-0 flex-col items-start gap-1">
            <div className="flex flex-wrap items-center gap-2">
              {title}
              {badges}
              {isDirty && <UnsavedChangesChip />}
            </div>
            <span className="text-muted text-sm">{subtitle}</span>
          </div>
          <Accordion.Indicator />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body>
          {typeof children === "function" ? children(setIsDirty) : children}
        </Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  );
}
