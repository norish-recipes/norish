import { spawnSync } from "node:child_process";

const madgeArgs = [
  "dlx",
  "madge",
  "--circular",
  "--json",
  "--extensions",
  "ts,tsx",
  "--ts-config",
  "tsconfig.json",
  "app",
  "components",
  "config",
  "context",
  "hooks",
  "i18n",
  "lib",
  "server",
  "store",
  "stores",
  "types",
];

const result = spawnSync("pnpm", madgeArgs, {
  encoding: "utf8",
});

if (result.error) {
  console.error("Failed to run madge:", result.error.message);
  process.exit(1);
}

let cycles;

try {
  cycles = JSON.parse(result.stdout || "[]");
} catch {
  console.error("Failed to parse madge output as JSON.");
  if (result.stdout) {
    console.error(result.stdout);
  }
  if (result.stderr) {
    console.error(result.stderr);
  }
  process.exit(1);
}

if (!Array.isArray(cycles)) {
  console.error("Unexpected madge output shape.");
  process.exit(1);
}

if (cycles.length > 0) {
  console.error(`Found ${cycles.length} circular dependenc${cycles.length === 1 ? "y" : "ies"}.`);
  for (const cycle of cycles) {
    if (Array.isArray(cycle)) {
      console.error(`- ${cycle.join(" -> ")}`);
    }
  }
  process.exit(1);
}

if (result.status !== 0) {
  if (result.stderr) {
    console.error(result.stderr);
  }
  process.exit(result.status ?? 1);
}

console.log("No circular dependencies found.");
