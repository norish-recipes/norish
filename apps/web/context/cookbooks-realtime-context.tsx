"use client";

import type { ReactNode } from "react";
import { useCookbooksSubscription } from "@/hooks/cookbooks";

/**
 * Mounts the cookbook realtime subscription for the whole app.
 *
 * A cookbook's member count, its derived cover and everything else a card says
 * about it are computed per reader on the server, so a membership change is
 * not something a client can finish on its own — the echo is what carries the
 * real answer back, to the reader who made the change as much as to a
 * housemate who did not. Without it a card keeps whatever the optimistic patch
 * left behind until something else happens to refetch the list.
 *
 * It hangs here rather than on a page because every surface that shows a
 * cookbook has to converge, and the Library is not mounted while a reader is
 * on a recipe filing into one. Providing no value is the point: this exists to
 * hold a subscription open, in the shape `ArchiveImportProvider` already uses.
 */
export function CookbooksRealtimeProvider({ children }: { children: ReactNode }) {
  useCookbooksSubscription();

  return <>{children}</>;
}
