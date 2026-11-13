"use client";

import { useMemo } from "react";

import type { OfflineEngine } from "../engine";
import type { WarmSet } from "../warm-set";
import { useTRPC } from "../../trpc";

export function useWarmSet(engine: Pick<OfflineEngine, "createWarmSet">): WarmSet {
  const trpc = useTRPC();

  return useMemo(() => engine.createWarmSet(trpc), [engine, trpc]);
}
