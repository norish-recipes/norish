import eslintReact from "@eslint-react/eslint-plugin";
import stylistic from "@stylistic/eslint-plugin";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import { defineConfig } from "eslint/config";

export const reactConfig = defineConfig(
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // `crypto.randomUUID` exists only in a secure context. A self-hosted
      // Norish is routinely reached over plain HTTP on a LAN name, where it is
      // simply undefined and the component throws on render. Guarded forms
      // (`globalThis.crypto?.randomUUID` with a fallback) are deliberately not
      // matched.
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='crypto'][property.name='randomUUID']",
          message:
            "crypto.randomUUID is undefined outside a secure context. Use createClientId() from @norish/shared/lib/operation-helpers.",
        },
        // The React Compiler knows a hook only by its name. An alias without the
        // `use` prefix is compiled as a plain call, which it may memoise into a
        // conditional one.
        ...[
          "VariableDeclarator[id.type='Identifier'][id.name!=/^use[A-Z0-9]/][init.type='MemberExpression'][init.property.name=/^use[A-Z0-9]/]",
          "VariableDeclarator[id.type='Identifier'][id.name!=/^use[A-Z0-9]/][init.type='Identifier'][init.name=/^use[A-Z0-9]/]",
          "ObjectPattern > Property[key.name=/^use[A-Z0-9]/][value.type='Identifier'][value.name!=/^use[A-Z0-9]/]",
        ].map((selector) => ({
          selector,
          message: "A hook alias keeps the `use` prefix, so the React Compiler still sees a hook.",
        })),
        // The compiler's infer mode compiles top-level components and hooks
        // only: one a factory builds is skipped unless it opts in.
        ...[
          ":function :function[id.name=/^(use[A-Z0-9]|[A-Z])/]:not([body.body.0.directive='use memo'])",
          ":function VariableDeclarator[id.name=/^(use[A-Z0-9]|[A-Z])/] > :function:not([body.body.0.directive='use memo'])",
        ].map((selector) => ({
          selector,
          message:
            'A hook or component built inside a function starts with "use memo", or the React Compiler skips it.',
        })),
        // React Compiler 1.0 cannot lower a `finally`, and skips the whole
        // component or hook that has one, event handlers included.
        ...[
          ":function[id.name=/^(use[A-Z0-9]|[A-Z])/] TryStatement[finalizer]",
          "VariableDeclarator[id.name=/^(use[A-Z0-9]|[A-Z])/] > :function TryStatement[finalizer]",
        ].map((selector) => ({
          selector,
          message:
            "The React Compiler skips a component or hook with a `finally` in it: chain `.finally()` on the promise instead.",
        })),
      ],
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [eslintReact.configs["recommended-typescript"], jsxA11y.configs.recommended],
    plugins: {
      "@stylistic": stylistic,
    },
    languageOptions: {
      globals: {
        React: "writable",
      },
    },
    rules: {
      // What the React Compiler assumes of a component, checked as it is
      // written: no ref read or written during render, nothing a render
      // received mutated, and no state set synchronously in an effect.
      "@eslint-react/refs": "error",
      "@eslint-react/immutability": "error",
      "@eslint-react/set-state-in-effect": "error",
      "@stylistic/jsx-self-closing-comp": "warn",
      "@stylistic/jsx-sort-props": [
        "warn",
        {
          callbacksLast: true,
          shorthandFirst: true,
          noSortAlphabetically: false,
          reservedFirst: true,
        },
      ],
      "jsx-a11y-x/click-events-have-key-events": "warn",
      "jsx-a11y-x/interactive-supports-focus": "warn",
    },
  }
);
