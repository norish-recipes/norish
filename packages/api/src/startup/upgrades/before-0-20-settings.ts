import type { PromptConfigField } from "@norish/shared-server/ai/prompts/overrides";
import { getConfig, setConfig } from "@norish/db/repositories/server-config";
import { ServerConfigKeys } from "@norish/db/zodSchemas/server-config";
import { loadDefaultPrompts } from "@norish/shared-server/ai/prompts/loader";
import {
  isSamePromptText,
  PROMPT_CONFIG_FIELDS,
  pruneToOverrides,
} from "@norish/shared-server/ai/prompts/overrides";
import { serverLogger as log } from "@norish/shared-server/logger";

import shippedPrompts from "./before-0-20-prompt-defaults.json" with { type: "json" };

/** The default texts releases up to 0.25 shipped, per prompt. */
const SHIPPED_PROMPTS: Partial<Record<PromptConfigField, readonly string[]>> = shippedPrompts;

type StoredAIConfig = Record<string, unknown> & {
  autoTaggingMode?: string;
  autoTagAllergies?: boolean;
  tagStrategy?: string;
  automaticEnrichment?: Record<string, unknown>;
};

/** 0.19's `autoTaggingMode` and `autoTagAllergies` become the switches and strategy that replaced them. */
export async function upgradeTaggingSettings(): Promise<void> {
  const stored = await getConfig<StoredAIConfig>(ServerConfigKeys.AI_CONFIG, true);

  if (!stored || !("autoTaggingMode" in stored || "autoTagAllergies" in stored)) return;

  const { autoTaggingMode, autoTagAllergies, ...rest } = stored;
  const tagging = autoTaggingMode === undefined ? undefined : autoTaggingMode !== "disabled";

  await setConfig(
    ServerConfigKeys.AI_CONFIG,
    {
      ...rest,
      tagStrategy: rest.tagStrategy ?? (tagging ? autoTaggingMode : undefined),
      automaticEnrichment: {
        ...rest.automaticEnrichment,
        autoTagging: rest.automaticEnrichment?.autoTagging ?? tagging,
        allergyDetection: rest.automaticEnrichment?.allergyDetection ?? autoTagAllergies,
      },
    },
    null
  );
  log.info("Upgraded the auto-tagging settings of a release before 0.20");
}

/**
 * A prompts row from before 0.20 (`isOverridden`) holds a copy of every default it was seeded with;
 * only the texts no release shipped are an administrator's, so the rest go.
 */
export async function upgradePromptCopies(): Promise<void> {
  const stored = await getConfig<Record<string, unknown>>(ServerConfigKeys.PROMPTS);

  if (!stored || !("isOverridden" in stored)) return;

  const overrides = pruneToOverrides(stored, loadDefaultPrompts());

  for (const field of PROMPT_CONFIG_FIELDS) {
    const text = overrides[field];

    if (text && SHIPPED_PROMPTS[field]?.some((shipped) => isSamePromptText(text, shipped))) {
      delete overrides[field];
    }
  }

  await setConfig(ServerConfigKeys.PROMPTS, overrides, null, false);
  log.info(
    { overriddenFields: Object.keys(overrides) },
    "Upgraded the prompts of a release before 0.20"
  );
}
