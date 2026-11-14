const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

// Node strips the TypeScript, so the extension takes the server's limits with no copied literal.
const UPLOADS = path.join(__dirname, "../../../packages/shared/src/contracts/uploads.ts");
const OUTPUT = path.join(__dirname, "../targets/share/ShareLimits.swift");

/** The server's import limits the Share Extension checks before it sends anything. */
function buildLimits() {
  const { MAX_OCR_FILES, MAX_RECIPE_PASTE_CHARS } = require(UPLOADS);

  return `// Generated at prebuild by plugins/with-share-limits.js from packages/shared.
enum ShareLimits {
  /// MAX_OCR_FILES: photos per import.
  static let maxImages = ${MAX_OCR_FILES}
  /// MAX_RECIPE_PASTE_CHARS: pasted text, in UTF-16 code units as JavaScript counts it.
  static let maxPasteChars = ${MAX_RECIPE_PASTE_CHARS}
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
