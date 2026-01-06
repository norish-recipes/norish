/**
 * Check for missing locale keys
 *
 * Uses `en` as the source of truth and reports:
 * - Missing keys in other locales
 * - Extra keys in other locales (not in source)
 *
 * Usage: node scripts/check-locale-keys.js
 * Exit code: 1 if missing keys found, 0 otherwise
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.join(__dirname, "../i18n/messages");

const SOURCE_LOCALE = "en";

/**
 * Recursively get all keys from a nested object
 * @param {object} obj
 * @param {string} prefix
 * @returns {Set<string>}
 */
function getKeys(obj, prefix = "") {
  const keys = new Set();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const nestedKey of getKeys(value, fullKey)) {
        keys.add(nestedKey);
      }
    } else {
      keys.add(fullKey);
    }
  }

  return keys;
}

/**
 * Load and parse a JSON file
 * @param {string} filePath
 * @returns {object|null}
 */
function loadJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get all locale directories
 * @returns {string[]}
 */
function getLocales() {
  return fs
    .readdirSync(messagesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
}

/**
 * Get all namespace files for a locale
 * @param {string} locale
 * @returns {string[]}
 */
function getNamespaces(locale) {
  const localeDir = path.join(messagesDir, locale);
  return fs
    .readdirSync(localeDir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(".json", ""));
}

function main() {
  const locales = getLocales();
  const targetLocales = locales.filter((l) => l !== SOURCE_LOCALE);

  if (!locales.includes(SOURCE_LOCALE)) {
    console.error(`Source locale '${SOURCE_LOCALE}' not found`);
    process.exit(1);
  }

  const sourceNamespaces = getNamespaces(SOURCE_LOCALE);
  let hasErrors = false;

  console.log(`\nChecking locale keys (source: ${SOURCE_LOCALE})\n`);
  console.log("=".repeat(60));

  for (const targetLocale of targetLocales) {
    const targetNamespaces = getNamespaces(targetLocale);
    const localeMissing = [];
    const localeExtra = [];

    // Check for missing namespaces
    for (const ns of sourceNamespaces) {
      if (!targetNamespaces.includes(ns)) {
        localeMissing.push(`[${ns}] (entire namespace missing)`);
        hasErrors = true;
        continue;
      }

      const sourceFile = path.join(messagesDir, SOURCE_LOCALE, `${ns}.json`);
      const targetFile = path.join(messagesDir, targetLocale, `${ns}.json`);

      const sourceData = loadJson(sourceFile);
      const targetData = loadJson(targetFile);

      if (!sourceData || !targetData) continue;

      const sourceKeys = getKeys(sourceData);
      const targetKeys = getKeys(targetData);

      // Find missing keys
      for (const key of sourceKeys) {
        if (!targetKeys.has(key)) {
          localeMissing.push(`[${ns}] ${key}`);
          hasErrors = true;
        }
      }

      // Find extra keys
      for (const key of targetKeys) {
        if (!sourceKeys.has(key)) {
          localeExtra.push(`[${ns}] ${key}`);
        }
      }
    }

    // Check for extra namespaces
    for (const ns of targetNamespaces) {
      if (!sourceNamespaces.includes(ns)) {
        localeExtra.push(`[${ns}] (entire namespace extra)`);
      }
    }

    // Report for this locale
    console.log(`\n${targetLocale}:`);

    if (localeMissing.length === 0 && localeExtra.length === 0) {
      console.log("    All keys match source");
    }

    if (localeMissing.length > 0) {
      console.log(`    Missing ${localeMissing.length} key(s):`);
      for (const key of localeMissing) {
        console.log(`    - ${key}`);
      }
    }

    if (localeExtra.length > 0) {
      console.log(`    Extra ${localeExtra.length} key(s):`);
      for (const key of localeExtra) {
        console.log(`    + ${key}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));

  if (hasErrors) {
    console.log("\n  Missing keys detected. Please add translations.\n");
    process.exit(1);
  } else {
    console.log("\n  All locales have complete translations.\n");
    process.exit(0);
  }
}

main();
