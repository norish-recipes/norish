import type { inferRouterInputs } from "@trpc/server";
import { skipToken, useQuery } from "@tanstack/react-query";

import type { AppRouter } from "@norish/trpc/client";

import { useTRPC } from "../trpc";

type AdminInput = inferRouterInputs<AppRouter>["admin"];

const NONE: never[] = [];
const ASKED_A_MINUTE = { staleTime: 60_000, retry: false };

/** The models a provider offers; `null` asks nothing, until the form can name a provider it can reach. */
export function useAvailableModelsQuery(input: AdminInput["listAvailableModels"] | null) {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(
    trpc.admin.listAvailableModels.queryOptions(input ?? skipToken, ASKED_A_MINUTE)
  );

  return {
    models: data?.models ?? NONE,
    /** Why the provider gave nothing back, when it was asked and declined. */
    refusal: data?.refusal,
    error,
    isLoading,
  };
}

/** The transcription models a provider offers; `null` asks nothing. */
export function useAvailableTranscriptionModelsQuery(
  input: AdminInput["listAvailableTranscriptionModels"] | null
) {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(
    trpc.admin.listAvailableTranscriptionModels.queryOptions(input ?? skipToken, ASKED_A_MINUTE)
  );

  return { models: data?.models ?? NONE, refusal: data?.refusal, error, isLoading };
}

/** The yt-dlp release the server runs, asked of the binary; `null` when there is none. */
export function useYtDlpVersionQuery() {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(
    trpc.admin.getYtDlpVersion.queryOptions(undefined, ASKED_A_MINUTE)
  );

  return { version: data?.version ?? null, error, isLoading };
}
