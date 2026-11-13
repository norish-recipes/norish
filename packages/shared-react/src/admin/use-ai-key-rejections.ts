import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";
import { NONE } from "./types";

/** The configured AI keys the provider is refusing, by block and since when; empty while all answer. */
export function useAIKeyRejectionsQuery() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.admin.aiKeyRejections.queryOptions());

  return data ?? NONE;
}
