"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import { LockClosedIcon } from "@heroicons/react/24/outline";
import { Alert } from "@heroui/react";

interface NoteProps {
  /** `warning` only for real caution; something merely worth knowing stays `default`. */
  status?: "default" | "accent" | "warning" | "danger";
  title?: ReactNode;
  /** A lock instead of the status's own icon: what the note says cannot be changed. */
  locked?: boolean;
  /** An icon instead of the status's own: what the note is about, such as a merge. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  children: ReactNode;
}

/**
 * Something worth knowing beside the controls it is about, set apart from
 * them: an icon that says what kind of note it is, so its words need no
 * "Note:" in front. One shape for every note in a card or a dialog.
 */
export function Note({ status = "default", title, locked, icon: Icon, children }: NoteProps) {
  return (
    <Alert className="bg-surface-secondary rounded-2xl shadow-none" status={status}>
      <Alert.Indicator>
        {locked ? <LockClosedIcon aria-hidden className="size-5" /> : null}
        {Icon ? <Icon aria-hidden className="size-5" /> : null}
      </Alert.Indicator>
      <Alert.Content className="gap-1">
        {title ? <Alert.Title>{title}</Alert.Title> : null}
        <div className="text-muted text-sm">{children}</div>
      </Alert.Content>
    </Alert>
  );
}
