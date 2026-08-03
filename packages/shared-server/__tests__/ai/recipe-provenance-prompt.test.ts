// @vitest-environment node
/**
 * The shipped Recipe Provenance prompt.
 *
 * Asserted against the shipped prompt file rather than a mock, because the file
 * is what a deployment actually sends to the model. Admin overrides replace it
 * wholesale and are deliberately untouched by these expectations.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";

const PROVENANCE_PROMPT = readFileSync(
  join(
    resolveExistingWorkspacePath(join("packages", "shared-server", "src", "ai", "prompts")),
    "recipe-provenance.txt"
  ),
  "utf-8"
);

describe("the shipped Recipe Provenance prompt", () => {
  it("asks for the single country with the strongest claim", () => {
    // Contested classics must not stay flagless forever: ambiguity picks the
    // strongest claim rather than bailing out to null.
    expect(PROVENANCE_PROMPT).toMatch(/single country/i);
    expect(PROVENANCE_PROMPT).toMatch(/strongest claim/i);
    expect(PROVENANCE_PROMPT).not.toMatch(/null if no single country fits/i);
  });

  it("acknowledges rival claims in the note instead of the country field", () => {
    expect(PROVENANCE_PROMPT).toMatch(/acknowledge the rivals in the note/i);
    expect(PROVENANCE_PROMPT).toMatch(/name the rival\s+claims/i);
  });

  it("reserves null for the genuinely unplaceable", () => {
    expect(PROVENANCE_PROMPT).toMatch(/null only when the dish belongs to no national tradition/i);
    expect(PROVENANCE_PROMPT).toMatch(/genuinely\s+unplaceable/i);
  });

  it("asks for the country's written name in the recipe's language", () => {
    expect(PROVENANCE_PROMPT).toMatch(/originCountryName/);
    expect(PROVENANCE_PROMPT).toMatch(
      /WRITE THE NOTE AND THE COUNTRY NAME IN THE LANGUAGE THE RECIPE ITSELF IS\nWRITTEN IN/
    );
    // The name is the code's companion and clears with it.
    expect(PROVENANCE_PROMPT).toMatch(/null exactly when originCountry is null/i);
  });

  it("still pins Cuisine names to the vocabulary's own spelling", () => {
    expect(PROVENANCE_PROMPT).toMatch(/VERBATIM/);
    expect(PROVENANCE_PROMPT).toContain("{{cuisines}}");
    expect(PROVENANCE_PROMPT).toContain("{{cuisineFallback}}");
  });

  it("keeps every template variable the loader fills", () => {
    for (const variable of ["recipeName", "description", "ingredients", "cuisines"]) {
      expect(PROVENANCE_PROMPT).toContain(`{{${variable}}}`);
    }
  });
});
