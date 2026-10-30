import { readFileSync } from "node:fs";
import path from "node:path";

const REQUIRED_SERVER_FILES = path.resolve(
  import.meta.dirname,
  "../../../.next/required-server-files.json"
);

/** The base path the web app was built for, read from the build; empty for a root build or none. */
export const BUILT_BASE_PATH: string = (() => {
  try {
    const files = JSON.parse(readFileSync(REQUIRED_SERVER_FILES, "utf8")) as {
      config: { basePath?: string };
    };

    return files.config.basePath ?? "";
  } catch {
    return "";
  }
})();
