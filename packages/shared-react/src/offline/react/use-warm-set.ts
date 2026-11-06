"use client";

import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { useMemo } from "react";

import type { AppRouter } from "@norish/trpc/client";

import type { OfflineEngine } from "../engine";
import type { WarmSet } from "../warm-set";

export function useWarmSet(
  engine: Pick<OfflineEngine, "createWarmSet">,
  trpc: TRPCOptionsProxy<AppRouter>
): WarmSet {
  return useMemo(() => engine.createWarmSet(trpc), [engine, trpc]);
}
