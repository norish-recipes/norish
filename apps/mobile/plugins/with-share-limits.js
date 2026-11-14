const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

// Node strips the TypeScript, so the extension takes the server's limits with no copied literal.
const UPLOADS = path.join(__dirname, "../../../packages/shared/src/contracts/uploads.ts");
const OUTPUT = path.join(__dirname, "../targets/share/ShareLimits.swift");

/** The server's photo limit, which the Share Extension checks before it sends anything. */
function buildLimits() {
  const { MAX_OCR_FILES } = require(UPLOADS);

  return `// Generated at prebuild by plugins/with-share-limits.js from packages/shared.
enum ShareLimits {
  /// MAX_OCR_FILES: photos per import.
  static let maxImages = ${MAX_OCR_FILES}
}
`;
}

/** Writes the extension's ShareLimits.swift before Xcode syncs the folder. */
module.exports = (config) =>
  withDangerousMod(config, [
    "ios",
    (modConfig) => {
      fs.writeFileSync(OUTPUT, buildLimits());

      return modConfig;
    },
  ]);

module.exports.buildLimits = buildLimits;
