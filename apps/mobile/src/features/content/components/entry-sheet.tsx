import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { FitSheet } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { SheetNote } from "@/components/sheet-note";
import { useText } from "@/lib/i18n/use-text";

type Field = Omit<ComponentProps<typeof SheetInput>, "returnKeyType" | "onSubmitEditing"> & {
  /** Submitting from the keyboard does nothing while this is false. */
  canSubmit: boolean;
  onSubmit: () => void;
};

/** A sheet over one named entry: its name field, then the notes (`before` the problem), the
 * problem the name has, the screen's own `children`, and the offline note last. */
export function EntrySheet({
  field: { canSubmit, onSubmit, ...field },
  before,
  problem,
  offline = false,
  children,
  ...sheet
}: Omit<ComponentProps<typeof FitSheet>, "children"> & {
  field: Field;
  before?: ReactNode;
  problem?: { key: string; values?: Record<string, string | number> } | null;
  offline?: boolean;
  children?: ReactNode;
}) {
  const text = useText();

  return (
    <FitSheet {...sheet}>
      <SheetInput
        {...field}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (canSubmit) onSubmit();
        }}
      />
      {before}
      {problem ? (
        <SheetNote tone="problem">
          {text(`settings.content.${problem.key}`, problem.values)}
        </SheetNote>
      ) : null}
      {children}
      {offline ? <SheetNote>{text("settings.content.offline")}</SheetNote> : null}
    </FitSheet>
  );
}
