"use client";

import { useFormatter, useTranslations } from "next-intl";

import { useAIKeyRejectionsQuery } from "@norish/shared-react/admin";

/** Each settings block's heading under AI processing, by the config key a rejection names. */
const BLOCK_TITLES = {
  ai_config: "aiConfig.title",
  video_config: "video.title",
  image_generation_config: "imageGeneration.title",
  decision_config: "decisionModel.title",
} as const;

/**
 * The configured AI keys the provider is refusing, in the admin's words: which blocks, and since
 * when. Null while every key answers. An admin-only read: only an admin's components mount it.
 */
export function useAIKeyRejections() {
  const t = useTranslations("common.aiKeyRejected");
  const tBlocks = useTranslations("settings.admin.aiProcessing");
  const format = useFormatter();
  const data = useAIKeyRejectionsQuery();

  if (data.length === 0) return null;

  const since = data.map((rejection) => rejection.since).sort((a, b) => (a < b ? -1 : 1))[0]!;

  return {
    /** Changes when another block is refused, or a block is refused anew after it answered. */
    id: data.map((rejection) => `${rejection.block}@${rejection.since}`).join(","),
    title: t("title"),
    description: t("description", {
      blocks: format.list(data.map((rejection) => tBlocks(BLOCK_TITLES[rejection.block]))),
      since: format.dateTime(new Date(since), { dateStyle: "medium", timeStyle: "short" }),
    }),
  };
}
