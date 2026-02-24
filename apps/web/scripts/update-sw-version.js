import fs from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { version } = require("../../../package.json");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const swPath = path.join(__dirname, "../public/sw.js");

if (!fs.existsSync(swPath)) {
  console.error("Service worker not found, skipping version update");
  process.exit(0);
}

let content = fs.readFileSync(swPath, "utf8");
content = content.replace(/__CACHE_VERSION__/g, version);
fs.writeFileSync(swPath, content);
