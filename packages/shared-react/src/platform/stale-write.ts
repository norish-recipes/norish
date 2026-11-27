"use client";

import { answered } from "../offline/settled";
import { showRefusal, usePlatform } from "./platform";

/** `wentThrough`, except a stale answer (an out-of-date version, ignored) did not. */
export const wentThroughFresh = (write: Promise<{ stale?: boolean }>): Promise<boolean> =>
  answered(write).then((answer) => answer !== null && !answer.stale);

/** `accepted`, except a stale answer did not. */
export const acceptedFresh = (
  write: Promise<{ success: boolean; stale?: boolean }>
): Promise<boolean> =>
  answered(write).then((answer) => answer !== null && answer.success && !answer.stale);

/** Tells the reader a stale write was refused because it changed elsewhere. */
export function useStaleRefusal() {
  const { showError, toast } = usePlatform();

  return (context: string) =>
    showRefusal(showError, { error: toast.translate("common.changedElsewhere.title") }, context);
}
