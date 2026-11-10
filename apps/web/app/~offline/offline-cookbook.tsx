"use client";

import { CookbookSkeleton } from "@/app/(app)/(library)/cookbooks/[id]/cookbook-page";
import CookbookRoute from "@/app/(app)/(library)/cookbooks/[id]/page";
import { OfflineUnavailable } from "@/app/~offline/offline-unavailable";
import { routeParams } from "@/app/~offline/route-params";
import { offlineEngine } from "@/lib/offline/engine";
import { useQueryClient } from "@tanstack/react-query";

import { useCacheOwner } from "@norish/shared-react/offline/react";
import { useTRPC } from "@norish/shared-react/trpc";

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
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const owner = useCacheOwner(offlineEngine.cache);

  if (!owner) return <CookbookSkeleton />;

  const warmed = queryClient.getQueryData(trpc.cookbooks.get.queryOptions({ id }).queryKey);

  if (!warmed) {
    return <OfflineUnavailable />;
  }

  return <CookbookRoute params={routeParams(id)} />;
}
