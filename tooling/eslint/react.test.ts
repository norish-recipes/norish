import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import { compiledReactConfig, reactConfig } from "./react.ts";

/** The rule messages `code` gets under the compiled-code config. */
function lint(code: string): string[] {
  return new Linter().verify(code, compiledReactConfig, "file.ts").map(({ message }) => message);
}

/** The restricted-syntax messages JSX `code` gets under the React config. */
function lintJsx(code: string): string[] {
  const rules = { "no-restricted-syntax": reactConfig[0]?.rules?.["no-restricted-syntax"] };
  const jsx = { parserOptions: { ecmaFeatures: { jsx: true } } };

  return new Linter()
    .verify(code, [{ languageOptions: jsx, rules }], "file.js")
    .map(({ message }) => message);
}

describe("reactConfig", () => {
  it("asks every DndContext for an id", () => {
    expect(lintJsx("const a = <DndContext sensors={s} />;")).toEqual([
      "dnd-kit numbers DndContext's aria-describedby from a counter the server and client don't share: give it id={useId()}.",
    ]);
    expect(lintJsx("const a = <DndContext id={id} sensors={s} />;")).toEqual([]);
  });
});

const skipped =
  "The React Compiler skips a component or hook with `||=`, `&&=` or `??=` in it: write the assignment out.";

describe("compiledReactConfig", () => {
  it("flags a logical assignment in a hook, a component and a memo-wrapped arrow", () => {
    expect(lint("function useCount(a) { a.n ||= 1; return a; }")).toEqual([skipped]);
    expect(lint("const Row = (props) => { props.n ??= 1; return null; };")).toEqual([skipped]);
    expect(lint("const Row = memo((props) => { props.n &&= 1; return null; });")).toEqual([
      skipped,
    ]);
    expect(lint("const Row = React.forwardRef((p, ref) => { p.n ||= 1; return null; });")).toEqual([
      skipped,
    ]);
  });

  it("leaves a plain function alone", () => {
    expect(lint("function count(a) { a.n ||= 1; return a; }")).toEqual([]);
  });
});
