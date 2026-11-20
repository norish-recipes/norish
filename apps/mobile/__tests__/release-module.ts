import { createRequire } from "node:module";

const fromExpo = createRequire(createRequire(import.meta.filename).resolve("expo/package.json"));
const preset = fromExpo.resolve("babel-preset-expo");
const fromPreset = createRequire(preset);

/** The slice of a Babel AST node and path that `worklet-closures.test.ts` reads. */
type AstNode = {
  type: string;
  start: number;
  end: number;
  name?: string;
  id?: AstNode | null;
  callee?: AstNode;
  arguments?: AstNode[];
  elements?: (AstNode | null)[];
};
type AstPath = {
  node: AstNode;
  scope: { getBinding(name: string): { kind: string; path: AstPath } | undefined };
  getFunctionParent(): AstPath | null;
};
/** The calls this needs from the preset's own Babel. */
type Babel = {
  transformFileSync(file: string, options: object): { code?: string | null } | null;
  parseSync(code: string, options: object): object | null;
  traverse(ast: object, visitor: Record<string, (path: AstPath) => void>): void;
};
export const babel: Babel = fromPreset("@babel/core");

/** `file` compiled as a release build has it: Expo's preset with the React Compiler and the
 * worklets plugin on. */
export function releaseCode(file: string) {
  return (
    babel.transformFileSync(file, {
      babelrc: false,
      configFile: false,
      presets: [preset],
      caller: { name: "metro", platform: "ios", isDev: false, supportsReactCompiler: true },
    })?.code ?? ""
  );
}

/** A fresh copy of `file` as a release build has it. `modules` stand in for its imports; Babel's
 * runtime helpers load as they are. */
export function releaseModule<T>(file: string, modules: Record<string, unknown> = {}): T {
  const exports = {};

  new Function("exports", "require", releaseCode(file))(exports, (id: string) =>
    id in modules ? modules[id] : fromPreset(id)
  );

  return exports as T;
}
