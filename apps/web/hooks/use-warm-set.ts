"use client";

import { useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { createWarmSet } from "@/lib/query-cache/warm-set";
import { useQueryClient } from "@tanstack/react-query";

export function useWarmSet() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMemo(() => createWarmSet({ queryClient, trpc }), [queryClient, trpc]);
}
