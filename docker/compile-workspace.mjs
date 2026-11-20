// Compiles the image's workspace TypeScript to JavaScript beside it, so the server runs without
// tsx: esbuild's transform, the one tsx applies at runtime, done once at build. Each @norish/*
// package's exports then name the .js files. Run from apps/web, whose esbuild it uses:
// node compile-workspace.mjs <dir>...
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const roots = process.argv.slice(2);
const { transformSync } = createRequire(join(process.cwd(), "package.json"))("esbuild");
let compiled = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);

    if (name === "node_modules") continue;
    if (statSync(path).isDirectory()) walk(path);
    else if (name === "package.json") rewriteExports(path);
    else if (/\.tsx?$/.test(name) && !name.endsWith(".d.ts")) compile(path);
  }
}

function compile(path) {
  const { code } = transformSync(readFileSync(path, "utf8"), {
    loader: path.endsWith(".tsx") ? "tsx" : "ts",
    format: "esm",
    target: "node26",
    jsx: "automatic",
    sourcefile: path,
  });

  writeFileSync(path.replace(/\.tsx?$/, ".js"), code);
  rmSync(path);
  compiled += 1;
}

function rewriteExports(path) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));

  if (!manifest.exports) return;
  manifest.exports = JSON.parse(
    JSON.stringify(manifest.exports).replace(/(?<!\.d)\.tsx?"/g, '.js"')
  );
  writeFileSync(path, JSON.stringify(manifest, null, 2));
}

for (const root of roots) walk(root);
console.log(`compiled ${compiled} TypeScript files`);
