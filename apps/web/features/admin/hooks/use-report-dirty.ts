import { useEffect } from "react";

/** Tells the accordion section holding a form whether it has unsaved edits, as that changes. */
export function useReportDirty(isDirty: boolean, onDirtyChange?: (isDirty: boolean) => void) {
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
}
