// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { webRoot, webSourceFiles } from "../helpers/web-source-files";

// The settings messages app/layout.tsx ships outside the settings route.
const SHIPPED = ["settings.ingredients", "settings.admin.aiProcessing"];

// Drawn only inside the settings route, under its own full provider.
const SETTINGS_ROUTE = ["app/(app)/settings/", "components/settings/", "features/household/"];

describe("the root layout's client messages", () => {
  it("hold every settings namespace read outside the settings route", () => {
    const reads = webSourceFiles()
      .filter((file) => !SETTINGS_ROUTE.some((prefix) => file.startsWith(prefix)))
      .flatMap((file) =>
        [
          ...fs
            .readFileSync(path.join(webRoot, file), "utf8")
            .matchAll(/useTranslations\("(settings[^"]*)"\)/g),
        ].map(([, namespace = ""]) => ({ file, namespace }))
      );

    // A broken walk must not read as a green run.
    expect(reads.length).toBeGreaterThan(0);
    expect(
      reads.filter(
        ({ namespace }) =>
          !SHIPPED.some((shipped) => namespace === shipped || namespace.startsWith(`${shipped}.`))
      )
    ).toEqual([]);
  });
});
