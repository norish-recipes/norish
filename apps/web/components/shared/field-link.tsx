"use client";

import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { inputVariants } from "@heroui/styles";
import { twMerge } from "tailwind-merge";

/** A field-shaped row that opens something: the field's own look, its value, and a chevron. */
export function FieldLink({
  value,
  onPress,
  "data-testid": testId,
}: {
  value: string;
  onPress: () => void;
  "data-testid"?: string;
}) {
  return (
    <button
      className={twMerge(
        inputVariants({ variant: "secondary", fullWidth: true }),
        "flex cursor-[var(--cursor-interactive)] items-center gap-3 text-start"
      )}
      data-testid={testId}
      type="button"
      onClick={onPress}
    >
      <span className="min-w-0 flex-1 truncate">{value}</span>
      <ChevronRightIcon aria-hidden className="text-muted size-4 shrink-0 rtl:rotate-180" />
    </button>
  );
}
