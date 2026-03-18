import jsxA11y from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

type FlatConfigLike = {
  plugins?: Record<string, unknown>;
  languageOptions?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  rules?: Record<string, unknown>;
};

const reactRecommended = reactPlugin.configs.flat?.recommended as FlatConfigLike | undefined;
const reactJsxRuntime = reactPlugin.configs.flat?.["jsx-runtime"] as FlatConfigLike | undefined;
const jsxA11yRecommended = (jsxA11y as { flatConfigs?: { recommended?: FlatConfigLike } })
  .flatConfigs?.recommended;

export const reactConfig = defineConfig(
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      ...reactRecommended?.plugins,
      ...reactJsxRuntime?.plugins,
      ...jsxA11yRecommended?.plugins,
    } as never,
    languageOptions: {
      ...reactRecommended?.languageOptions,
      ...reactJsxRuntime?.languageOptions,
      ...jsxA11yRecommended?.languageOptions,
      globals: {
        React: "writable",
      },
    },
    settings: {
      ...reactRecommended?.settings,
      react: {
        version: "detect",
      },
    },
    rules: {
      ...reactRecommended?.rules,
      ...reactJsxRuntime?.rules,
      ...jsxA11yRecommended?.rules,
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
  reactHooks.configs.flat.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/immutability": "off",
    },
  }
);
