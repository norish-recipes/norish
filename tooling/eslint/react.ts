import jsxA11y from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

const jsxA11yRecommended = jsxA11y.flatConfigs.recommended;

export const reactConfig = defineConfig(
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      ...reactPlugin.configs.flat.recommended.plugins,
      ...reactPlugin.configs.flat["jsx-runtime"].plugins,
      ...jsxA11yRecommended.plugins,
    },
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      ...reactPlugin.configs.flat["jsx-runtime"].languageOptions,
      ...jsxA11yRecommended.languageOptions,
      globals: {
        React: "writable",
      },
    },
    settings: {
      ...reactPlugin.configs.flat.recommended.settings,
      react: {
        version: "detect",
      },
    },
    rules: {
      ...reactPlugin.configs.flat.recommended.rules,
      ...reactPlugin.configs.flat["jsx-runtime"].rules,
      ...jsxA11yRecommended.rules,
      "react/prop-types": "off",
      "react/self-closing-comp": "warn",
      "react/jsx-sort-props": [
        "warn",
        {
          callbacksLast: true,
          shorthandFirst: true,
          noSortAlphabetically: false,
          reservedFirst: true,
        },
      ],
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/interactive-supports-focus": "warn",
    },
  },
  reactHooks.configs.flat["recommended-latest"]!,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
