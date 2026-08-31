"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Checkbox } from "@heroui/react";

const CHECKMARK_COMMIT_DELAY_MS = 220;

/**
 * Whether an event came from the checkbox rather than the row around it.
 *
 * React Aria checkboxes drop the `onClick` prop, so `stopPropagation` on the
 * Checkbox never runs and a row that is itself clickable would toggle twice —
 * once from the control and once from the row. Containment is what is left to
 * detect it with.
 */
export function isCheckboxEvent(event: { target: EventTarget | null }) {
  return event.target instanceof Element && event.target.closest('[data-slot="checkbox"]') !== null;
}

type GroceryCheckboxProps = {
  "aria-label": string;
  isSelected: boolean;
  isIndeterminate?: boolean;
  isDisabled?: boolean;
  delayChangeOnSelect?: boolean;
  size?: "md" | "lg";
  className?: string;
  onChange?: (isSelected: boolean) => void;
};

export function GroceryCheckbox({
  "aria-label": ariaLabel,
  isSelected,
  isIndeterminate = false,
  isDisabled = false,
  delayChangeOnSelect = false,
  size = "lg",
  className = "",
  onChange,
}: GroceryCheckboxProps) {
  const [visualSelected, setVisualSelected] = useState(isSelected);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlSize = size === "lg" ? "size-6" : "size-5";
  const indicatorSize =
    size === "lg"
      ? "[&_[data-slot='checkbox-default-indicator--checkmark']]:size-3.5"
      : "[&_[data-slot='checkbox-default-indicator--checkmark']]:size-3";

  useEffect(() => {
    if (!commitTimerRef.current) {
      setVisualSelected(isSelected);
    }
  }, [isSelected]);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
      }
    };
  }, []);

  const handleChange = useCallback(
    (nextSelected: boolean) => {
      if (isDisabled) return;

      if (commitTimerRef.current) {
        clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }

      setVisualSelected(nextSelected);

      if (delayChangeOnSelect && nextSelected && !isSelected) {
        commitTimerRef.current = setTimeout(() => {
          commitTimerRef.current = null;
          onChange?.(true);
        }, CHECKMARK_COMMIT_DELAY_MS);

        return;
      }

      onChange?.(nextSelected);
    },
    [delayChangeOnSelect, isDisabled, isSelected, onChange]
  );

  return (
    <Checkbox
      aria-label={ariaLabel}
      className={`${indicatorSize} ${className}`}
      isDisabled={isDisabled}
      isIndeterminate={visualSelected ? false : isIndeterminate}
      isSelected={visualSelected}
      variant="secondary"
      onChange={handleChange}
    >
      <Checkbox.Content>
        <Checkbox.Control
          className={`${controlSize} data-[indeterminate=true]:border-accent data-[indeterminate=true]:bg-accent data-[selected=true]:border-accent data-[selected=true]:bg-accent rounded-full before:rounded-full`}
        >
          <Checkbox.Indicator className="text-accent-foreground" />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}
