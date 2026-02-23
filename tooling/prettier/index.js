/** @typedef {import("prettier").Config} PrettierConfig */
/** @typedef {import("prettier-plugin-tailwindcss").PluginOptions} TailwindConfig */
/** @typedef {import("@ianvs/prettier-plugin-sort-imports").PluginConfig} SortImportsConfig */

/** @type {PrettierConfig & TailwindConfig & SortImportsConfig} */
const config = {
  printWidth: 100,
  trailingComma: "es5",
  singleQuote: false,
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
  ],
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
    "^[./]"
  ],
  importOrderParserPlugins: ["typescript", "jsx", "decorators-legacy"],
  importOrderTypeScriptVersion: "5.0.0"
};

export default config;
