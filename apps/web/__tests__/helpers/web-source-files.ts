import fs from "node:fs";
import path from "node:path";

export const webRoot = path.resolve(import.meta.dirname, "../..");

/** The app's own .ts and .tsx files, relative to apps/web, without its tests. */
export function webSourceFiles(): string[] {
  return ["app", "components", "features", "hooks", "lib"]
    .flatMap((dir) =>
      fs
        .readdirSync(path.join(webRoot, dir), { recursive: true, encoding: "utf8" })
        .map((file) => path.join(dir, file))
    )
    .filter(
      (file) =>
        /\.tsx?$/.test(file) &&
        !file.split(path.sep).includes("__tests__") &&
        !/\.test\./.test(path.basename(file))
    );
}
