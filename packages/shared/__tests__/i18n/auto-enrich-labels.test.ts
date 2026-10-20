// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const messagesDir = path.resolve(process.cwd(), "../i18n/src/messages");
const locales = fs
  .readdirSync(messagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const SIX_ACTIONS = [
  "Auto-tag",
  "Auto Categorize",
  "Estimate Nutrition",
  "Work Out Provenance",
  "Link Ingredients to Steps",
  "Generate Picture",
];

function read(locale: string, namespace: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(messagesDir, locale, `${namespace}.json`), "utf8")
  ) as Record<string, unknown>;
}

function autoEnrich(common: Record<string, unknown>): { title: string; description: string } {
  return common.autoEnrich as { title: string; description: string };
}

function settingsAutoEnrich(settings: Record<string, unknown>): {
  title: string;
  description: string;
} {
  const user = settings.user as {
    preferences: { autoEnrich: { title: string; description: string } };
  };

  return user.preferences.autoEnrich;
}

function expectActionsInOrder(description: string, locale: string): void {
  const positions = SIX_ACTIONS.map((action) => description.indexOf(action));

  expect(positions, locale).not.toContain(-1);
  expect(positions, locale).toEqual([...positions].sort((a, b) => a - b));
}

describe("Enhanced labels", () => {
  it("has the Enhanced title and all six actions in every locale", () => {
    expect(locales).toHaveLength(16);

    for (const locale of locales) {
      const common = autoEnrich(read(locale, "common"));
      const settings = settingsAutoEnrich(read(locale, "settings"));

      expect(common.title, locale).toBe("Enhanced");
      expect(settings.title, locale).toBe("Enhanced");

      expectActionsInOrder(common.description, locale);
      expectActionsInOrder(settings.description, locale);

      expect(settings.description, locale).toContain("Turn it off for one recipe");
    }
  });
});
