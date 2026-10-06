"use client";

import type { ReactNode } from "react";
import { Alert } from "@heroui/react";

interface NoteProps {
  /** `warning` only for real caution; something merely worth knowing stays `default`. */
  status?: "default" | "accent" | "warning" | "danger";
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Something worth knowing beside the controls it is about, set apart from
 * them: an icon that says what kind of note it is, so its words need no
 * "Note:" in front. One shape for every note in a card or a dialog.
 */
export function Note({ status = "default", title, children, className }: NoteProps) {
  return (
    <Alert
      className={`bg-surface-secondary rounded-2xl shadow-none ${className ?? ""}`}
      status={status}
    >
      <Alert.Indicator />
      <Alert.Content className="gap-1">
        {title ? <Alert.Title>{title}</Alert.Title> : null}
        <div className="text-muted text-sm">{children}</div>
      </Alert.Content>
    </Alert>
  );
}
