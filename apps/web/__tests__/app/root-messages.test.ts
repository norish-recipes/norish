// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { webRoot, webSourceFiles } from "../helpers/web-source-files";

// The settings messages app/layout.tsx ships outside the settings route.
const SHIPPED = ["settings.ingredients", "settings.admin.aiProcessing", "settings.admin.toasts"];

// Drawn only inside the settings route, under its own full provider.
const SETTINGS_ROUTE = [
  "app/(app)/settings/",
  "components/settings/",
  "features/household/",
  "features/account/",
  "features/admin/",
  "features/calendar/components/caldav/",
];

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

  it("hold every message a shared-react hook toasts", () => {
    const sharedRoot = path.resolve(webRoot, "../../packages/shared-react/src");
    const reads = fs
      .readdirSync(sharedRoot, { recursive: true, encoding: "utf8" })
      .filter(
        (file) =>
          /\.tsx?$/.test(file) &&
          !file.split(path.sep).includes("__tests__") &&
          !/\.test\./.test(path.basename(file))
      )
      .flatMap((file) =>
        [
          ...fs
            .readFileSync(path.join(sharedRoot, file), "utf8")
            // Every settings id, a template's fixed prefix included: ids travel through variables.
            .matchAll(/["'`](settings\.[^"'`$]*)/g),
        ].map(([, id = ""]) => ({ file, id }))
      );

    // A broken walk must not read as a green run.
    expect(reads.length).toBeGreaterThan(0);
    expect(
      reads.filter(({ id }) => !SHIPPED.some((shipped) => id.startsWith(`${shipped}.`)))
    ).toEqual([]);
  });
});
