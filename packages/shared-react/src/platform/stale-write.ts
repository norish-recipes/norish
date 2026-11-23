"use client";

import { showRefusal, usePlatform } from "../platform";

type VersionedAnswer = { success: boolean; stale?: boolean };

/** Whether the write went through; a stale answer came from an out-of-date version, ignored. */
export const tookIt = (write: Promise<VersionedAnswer>): Promise<boolean> =>
  write.then(
    (answer) => answer.success && !answer.stale,
    () => false
  );

/** Tells the reader a stale write was refused because it changed elsewhere. */
export function useStaleRefusal() {
  const { showError, toast } = usePlatform();

  return (context: string) =>
    showRefusal(showError, { error: toast.translate("common.changedElsewhere.title") }, context);
}
