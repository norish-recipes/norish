"use client";

import { useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { offlineEngine } from "@/lib/offline/engine";

export function useWarmSet() {
  const trpc = useTRPC();

  return useMemo(() => offlineEngine.createWarmSet(trpc), [trpc]);
}
