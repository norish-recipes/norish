"use client";

import { useSyncExternalStore } from "react";
import CookbookRoute from "@/app/(app)/cookbooks/[id]/page";
import { OfflineUnavailable } from "@/app/~offline/offline-unavailable";
import { routeParams } from "@/app/~offline/route-params";
import { useTRPC } from "@/app/providers/trpc-provider";
import { cacheManager } from "@/lib/query-cache";
import { Spinner } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Warmed-gated cookbook page for the offline bootstrap (ADR-0009).
 *
 * Every cookbook the reader can see is part of the guaranteed floor, so this
 * normally renders the ordinary page from the restored cache — members
 * included. A cookbook outside the floor gets the explicit
 * Offline-unavailable state rather than an endless spinner. The verdict waits
 * for the restore: before that, absence only means "not hydrated yet".
 */
export function OfflineCookbook({ id }: { id: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const owner = useSyncExternalStore(cacheManager.subscribe, cacheManager.owner, () => null);

  if (!owner) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner color="accent" size="lg" />
      </div>
    );
  }

  const warmed = queryClient.getQueryData(trpc.cookbooks.get.queryOptions({ id }).queryKey);

  if (!warmed) {
    return <OfflineUnavailable />;
  }

  return <CookbookRoute params={routeParams(id)} />;
}
