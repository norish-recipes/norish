import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import { compiledReactConfig, reactConfig } from "./react.ts";

const jsx = { parserOptions: { ecmaFeatures: { jsx: true } } };

/** The errors JSX `code` gets in a compiled workspace, under both React configs. */
function lint(code: string): (string | null)[] {
  return new Linter()
    .verify(code, [...reactConfig, ...compiledReactConfig, { languageOptions: jsx }], "file.tsx")
    .filter(({ severity }) => severity === 2)
    .map(({ ruleId }) => ruleId);
}

/** The restricted-syntax messages JSX `code` gets under the React config. */
function lintJsx(code: string): string[] {
  const rules = { "no-restricted-syntax": reactConfig[0]?.rules?.["no-restricted-syntax"] };

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

  it('asks a TanStack Virtual component to opt out of the compiler with "use no memo"', () => {
    expect(
      lintJsx(
        "function Rows({ n }) { const v = useWindowVirtualizer({ count: n }); return <b>{v.getTotalSize()}</b>; }"
      )
    ).toEqual([
      'A TanStack Virtual component opens with "use no memo": the React Compiler would memoise its rows on a virtualizer that never changes.',
    ]);
    expect(
      lintJsx(
        "function Rows({ n }) { 'use no memo'; const v = useWindowVirtualizer({ count: n }); return <b>{v.getTotalSize()}</b>; }"
      )
    ).toEqual([]);
  });
});

describe("compiledReactConfig", () => {
  it("reports a logical assignment the compiler skips, in a hook, a component and a forwardRef", () => {
    expect(
      lint("function useCount(a) { const [n] = useState(a.n); a.n ||= n; return a; }")
    ).toEqual(["react-hooks/todo"]);
    expect(lint("const Row = (p) => { let n = p.n; n ??= 1; return <b>{n}</b>; };")).toEqual([
      "react-hooks/todo",
    ]);
    expect(
      lint(
        "const Row = React.forwardRef((p, r) => { let n = p.n; n &&= 1; return <b ref={r}>{n}</b>; });"
      )
    ).toEqual(["react-hooks/todo"]);
  });

  it("reports a finally the compiler skips, in an event handler too", () => {
    expect(
      lint(
        "function Row({ a }) { const go = () => { try { a(); } catch {} finally { a(); } }; return <button onClick={go} />; }"
      )
    ).toEqual(["react-hooks/todo"]);
  });

  it('reports a finally in a hook a factory builds with "use memo"', () => {
    expect(
      lint(
        "function createHooks({ useTRPC }) { function useX() { 'use memo'; const t = useTRPC(); try { t.a(); } catch {} finally { t.b(); } return t; } return { useX }; }"
      )
    ).toEqual(["react-hooks/todo"]);
  });

  it("reports a broken rule of React once, though both plugins check it", () => {
    expect(lint("function Row() { const r = useRef(0); return <b>{r.current}</b>; }")).toEqual([
      "react-hooks/refs",
    ]);
    expect(lint("function Row() { const now = Date.now(); return <b>{now}</b>; }")).toEqual([
      "@eslint-react/purity",
    ]);
  });

  it("leaves a function the compiler doesn't compile alone", () => {
    expect(lint("function count(a) { a.n ||= 1; return a; }")).toEqual([]);
  });

  it('passes a TanStack Virtual component that opts out with "use no memo"', () => {
    expect(
      lint(
        "import { useVirtualizer } from '@tanstack/react-virtual'; function Rows({ n }) { 'use no memo'; const v = useVirtualizer({ count: n }); return <b>{v.getTotalSize()}</b>; }"
      )
    ).toEqual([]);
  });
});
