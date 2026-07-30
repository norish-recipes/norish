// @vitest-environment node
/**
 * Cuisine has left the predefined Tag vocabulary.
 *
 * Asserted against the shipped prompt file rather than a mock, because the file
 * is what a deployment actually sends to the model.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";

const AUTO_TAGGING_PROMPT = readFileSync(
  join(
    resolveExistingWorkspacePath(join("packages", "shared-server", "src", "ai", "prompts")),
    "auto-tagging.txt"
  ),
  "utf-8"
);

/** The cuisines the predefined Tag list used to carry. */
const FORMER_CUISINE_TAGS = [
  "italian",
  "mexican",
  "asian",
  "american",
  "mediterranean",
  "indian",
  "french",
  "thai",
  "japanese",
  "chinese",
];

describe("the shipped auto-tagging prompt", () => {
  const predefined = AUTO_TAGGING_PROMPT.slice(
    AUTO_TAGGING_PROMPT.indexOf("PREDEFINED TAGS:"),
    AUTO_TAGGING_PROMPT.indexOf("Do NOT create new tags")
  );

  it.each(FORMER_CUISINE_TAGS)("no longer offers %s as a tag", (cuisine) => {
    expect(predefined.toLowerCase()).not.toContain(cuisine);
  });

  it("keeps the tags that were never cuisines", () => {
    for (const tag of ["vegetarian", "breakfast", "slow cooker", "kid-friendly"]) {
      expect(predefined).toContain(tag);
    }
  });

  it("tells the model where cuisine lives instead", () => {
    // Without this the model reaches for a cuisine anyway and mints a free-form
    // tag, which is exactly the folksonomy the vocabulary exists to replace.
    expect(AUTO_TAGGING_PROMPT).toMatch(/Cuisines/);
  });
});
