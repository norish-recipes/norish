import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { APP_MAIN_HORIZONTAL_PADDING_CLASS } from "@/config/css-tokens";

describe("mobile UI tuning", () => {
  it("keeps mobile app horizontal padding token in css tokens", () => {
    expect(APP_MAIN_HORIZONTAL_PADDING_CLASS).toBe("px-4 md:px-6");
  });

  it("uses fixed toast offset of 48px", () => {
    const providersFile = fs.readFileSync(
      path.resolve(process.cwd(), "app/providers/base-providers.tsx"),
      "utf8"
    );

    expect(providersFile).toContain("toastOffset={48}");
  });
});
