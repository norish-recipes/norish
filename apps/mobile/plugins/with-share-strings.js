const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

const MESSAGES = path.join(__dirname, "../../../packages/i18n/src/messages");
const OUTPUT = path.join(__dirname, "../targets/share/Localizable.xcstrings");
// Catalogue codes as the app's CFBundleLocalizations names them; de-formal has no iOS language.
const IOS_CODES = { "de-informal": "de", "de-formal": null, no: "nb" };

const unit = (value) => ({ stringUnit: { state: "translated", value } });

/** One message as an xcstrings localization: plain text, or a whole-message ICU plural on `%lld`. */
function localization(message, where) {
  const plural = /^\{\w+, plural, (.*)\}$/s.exec(message);

  if (!plural) {
    if (/[{}]/.test(message))
      throw new Error(`${where}: only plain text or one plural is supported`);

    return unit(message);
  }
  const cases = {};

  for (const [, category, text] of plural[1].matchAll(
    /(zero|one|two|few|many|other) \{([^{}]*)\}/g
  )) {
    cases[category] = unit(text.replaceAll("#", "%lld"));
  }
  if (!cases.other) throw new Error(`${where}: a plural needs an "other" case`);

  return { variations: { plural: cases } };
}

/** The Share Extension's strings, `recipes.shareExtension` in every locale, as a string catalogue. */
function buildCatalogue() {
  const strings = {};

  for (const code of fs.readdirSync(MESSAGES).sort((a, b) => a.localeCompare(b))) {
    const iosCode = code in IOS_CODES ? IOS_CODES[code] : code;
    const messages = JSON.parse(
      fs.readFileSync(path.join(MESSAGES, code, "recipes.json"), "utf8")
    ).shareExtension;

    if (!iosCode || !messages) continue;
    for (const [key, message] of Object.entries(messages)) {
      strings[key] ??= { extractionState: "manual", localizations: {} };
      strings[key].localizations[iosCode] = localization(message, `${code}.${key}`);
    }
  }

  return { sourceLanguage: "en", strings, version: "1.0" };
}

/** Writes the extension's Localizable.xcstrings from packages/i18n before Xcode syncs the folder. */
module.exports = (config) =>
  withDangerousMod(config, [
    "ios",
    (modConfig) => {
      fs.writeFileSync(OUTPUT, `${JSON.stringify(buildCatalogue(), null, 2)}\n`);

      return modConfig;
    },
  ]);

module.exports.buildCatalogue = buildCatalogue;
