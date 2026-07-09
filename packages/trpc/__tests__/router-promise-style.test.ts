import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const routersDirectory = fileURLToPath(new URL("../src/routers", import.meta.url));

describe("router promise style", () => {
  it("does not allow .then() chains in router source", async () => {
    const entries = await readdir(routersDirectory, { recursive: true });
    const sourceFiles = entries.filter(
      (entry) => typeof entry === "string" && (entry.endsWith(".ts") || entry.endsWith(".tsx"))
    );
    const filesWithThen = (
      await Promise.all(
        sourceFiles.map(async (entry) => {
          const contents = await readFile(join(routersDirectory, entry), "utf8");

          return /\.then\s*\(/.test(contents) ? entry : null;
        })
      )
    ).filter((entry): entry is string => entry !== null);

    expect(filesWithThen).toEqual([]);
  });
});
