"use client";

import CookbookLoading from "@/app/(app)/(library)/cookbooks/[id]/loading";
import CookbookRoute from "@/app/(app)/(library)/cookbooks/[id]/page";
import { OfflineUnavailable } from "@/app/~offline/offline-unavailable";
import { routeParams } from "@/app/~offline/route-params";
import { offlineEngine } from "@/lib/offline/engine";

import { useCacheOwner } from "@norish/shared-react/offline/react";
import { useHeldReads } from "@norish/shared-react/recipes";

/**
 * Warmed-gated cookbook page for the offline bootstrap (ADR-0009).
 *
 * Every cookbook the reader can see is part of the guaranteed floor, so this
 * normally renders the ordinary page from the restored cache — members
 * included. A cookbook outside the floor gets the explicit
 * Offline-unavailable state rather than an endless skeleton. The verdict waits
 * for the restore: before that, absence only means "not hydrated yet".
 */
export function OfflineCookbook({ id }: { id: string }) {
  const held = useHeldReads();
  const owner = useCacheOwner(offlineEngine.cache);

  if (!owner) return <CookbookLoading />;

  const warmed = held.cookbook(id);

  if (!warmed) {
    return <OfflineUnavailable />;
  }

  return <CookbookRoute params={routeParams(id)} />;
}
