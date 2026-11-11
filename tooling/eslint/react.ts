import eslintReact from "@eslint-react/eslint-plugin";
import stylistic from "@stylistic/eslint-plugin";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

const restrictedSyntax = [
  // `crypto.randomUUID` exists only in a secure context. A self-hosted
  // Norish is routinely reached over plain HTTP on a LAN name, where it is
  // simply undefined and the component throws on render. Guarded forms
  // (`globalThis.crypto?.randomUUID` with a fallback) are deliberately not
  // matched.
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
  // TanStack Virtual mutates one virtualizer object, so the compiler's memos keep the first rows.
  // It skips `useVirtualizer` but compiles `useWindowVirtualizer`; both opt out explicitly.
  {
    selector:
      ":function:not([body.body.0.directive='use no memo']) > BlockStatement > VariableDeclaration > VariableDeclarator > CallExpression[callee.name=/^use(Window)?Virtualizer$/]",
    message:
      'A TanStack Virtual component opens with "use no memo": the React Compiler would memoise its rows on a virtualizer that never changes.',
  },
  // A hand-written key drifts from the router unnoticed: a dead ["calendar", "combined"] hid for months.
  // The array's first element is a string or the path array, as written or `as const`.
  ...[
    "Property[key.name=/^(queryKey|mutationKey)$/] > *",
    // The client methods that take a key itself; the rest take filters, which carry `queryKey:`.
    "CallExpression[callee.property.name=/^(getQueryData|setQueryData|getQueryState|setQueryDefaults|getQueryDefaults)$/] > *:first-child",
  ].map((selector) => ({
    selector: `${selector}:matches(${["elements.0", "expression.elements.0"].flatMap((first) => [`[${first}.value=type(string)]`, `[${first}.type='ArrayExpression']`]).join(", ")})`,
    message:
      "A tRPC read's key comes from its generated builder (trpc.x.y.queryKey(), .pathKey(), .pathFilter(), .queryFilter(), .mutationKey()); a read that is not tRPC names its key in a constant.",
  })),
  {
    selector: "JSXOpeningElement[name.name='DndContext']:not(:has(JSXAttribute[name.name='id']))",
    message:
      "dnd-kit numbers DndContext's aria-describedby from a counter the server and client don't share: give it id={useId()}.",
  },
];

export const reactConfig = defineConfig(
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: { "no-restricted-syntax": ["error", ...restrictedSyntax] },
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

// For the workspaces the React Compiler builds: web, mobile, shared-react and ui. Each diagnostic
// that makes the compiler skip a function is an error, including those the preset leaves off.
export const compiledReactConfig = defineConfig({
  files: ["**/*.ts", "**/*.tsx"],
  extends: [reactHooks.configs.flat["recommended-latest"]],
  rules: {
    "react-hooks/hooks": "error",
    "react-hooks/invariant": "error",
    "react-hooks/rule-suppression": "error",
    "react-hooks/syntax": "error",
    "react-hooks/todo": "error",
    "react-hooks/unsupported-syntax": "error",
    // The compiler skips these callers on purpose, and the rule reports them under "use no memo" too.
    "react-hooks/incompatible-library": "off",
    // @eslint-react's copies run instead, and neither is a skip; mobile switches its
    // set-state-in-effect off for now.
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/set-state-in-effect": "off",
    // The compiler plugin reports each of these as @eslint-react does, so its copy alone runs.
    "@eslint-react/error-boundaries": "off",
    "@eslint-react/immutability": "off",
    "@eslint-react/refs": "off",
    "@eslint-react/rules-of-hooks": "off",
    "@eslint-react/set-state-in-render": "off",
    "@eslint-react/static-components": "off",
    "@eslint-react/unsupported-syntax": "off",
    "@eslint-react/use-memo": "off",
    // @eslint-react's purity also catches `new Date()` and impure hooks, and the build never
    // checks purity, so the compiler plugin's copy reports no skip.
    "@eslint-react/purity": "error",
    "react-hooks/purity": "off",
  },
});
