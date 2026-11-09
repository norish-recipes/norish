import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import { compiledReactConfig } from "./react.ts";

/** The rule messages `code` gets under the compiled-code config. */
function lint(code: string): string[] {
  return new Linter().verify(code, compiledReactConfig, "file.ts").map(({ message }) => message);
}

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
