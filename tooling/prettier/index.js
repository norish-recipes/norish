/** @typedef {import("prettier").Config} PrettierConfig */
/** @typedef {import("prettier-plugin-tailwindcss").PluginOptions} TailwindConfig */
/** @typedef {import("@ianvs/prettier-plugin-sort-imports").PluginConfig} SortImportsConfig */

import { fileURLToPath } from "node:url";

const sortImportsPluginPath = fileURLToPath(
  import.meta.resolve("@ianvs/prettier-plugin-sort-imports")
);
const tailwindPluginPath = fileURLToPath(import.meta.resolve("prettier-plugin-tailwindcss"));

/** @type {PrettierConfig & TailwindConfig & SortImportsConfig} */
const config = {
  printWidth: 100,
  trailingComma: "es5",
  singleQuote: false,
  plugins: [sortImportsPluginPath, tailwindPluginPath],
  tailwindFunctions: ["cn", "cva", "clsx"],
  importOrder: [
    "<TYPES>",
    "^(react/(.*)$)|^(react$)|^(react-native(.*)$)",
    "^(next/(.*)$)|^(next$)",
    "<THIRD_PARTY_MODULES>",
    "",
    "<TYPES>^@norish",
    "^@norish/(.*)$",
    "",
    "<TYPES>^[.|..|~]",
    "^~/",
    "^[../]",
    "^[./]",
  ],
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
  importOrderTypeScriptVersion: "5.0.0",
};

export default config;
