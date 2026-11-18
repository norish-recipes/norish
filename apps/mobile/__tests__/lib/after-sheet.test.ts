// @vitest-environment jsdom
import { createRequire } from "node:module";
import path from "node:path";
import * as React from "react";
import * as compilerRuntime from "react/compiler-runtime";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

type AfterSheet = typeof import("@/lib/after-sheet");

const fromExpo = createRequire(createRequire(import.meta.filename).resolve("expo/package.json"));
const preset = fromExpo.resolve("babel-preset-expo");
/** The one call this needs from the preset's own Babel. */
type Babel = { transformFileSync(file: string, options: object): { code?: string | null } | null };
const babel: Babel = createRequire(preset)("@babel/core");
const modules: Record<string, unknown> = {
  react: React,
  "react/compiler-runtime": compilerRuntime,
};

/** A fresh copy of the module as a release build has it: Expo's preset with the React Compiler on. */
function releaseAfterSheet(): AfterSheet {
  const code =
    babel.transformFileSync(path.join(import.meta.dirname, "../../src/lib/after-sheet.ts"), {
      babelrc: false,
      configFile: false,
      presets: [preset],
      caller: { name: "metro", platform: "ios", isDev: false, supportsReactCompiler: true },
    })?.code ?? "";
  const exports = {};

  new Function("exports", "require", code)(exports, (id: string) => modules[id]);

  return exports as AfterSheet;
}

describe("after-sheet in a release build", () => {
  it("opens once the sheet has gone, once for a double tap", () => {
    const { openAfterSheet, useSheetExit } = releaseAfterSheet();
    const stack = renderHook(() => useSheetExit());
    const close = vi.fn();
    const open = vi.fn();

    expect(openAfterSheet(close, open)).toBe(true);
    expect(openAfterSheet(close, open)).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);

    act(() => stack.result.current());
    act(() => stack.result.current());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("closes a sheet tapped mid-presentation once it is up, then opens", () => {
    const { openAfterSheet, useSheetExit, useSheetPresenting } = releaseAfterSheet();
    const stack = renderHook(() => useSheetExit());
    const close = vi.fn();
    const open = vi.fn();

    renderHook(() => useSheetPresenting());
    openAfterSheet(close, open);
    expect(close).not.toHaveBeenCalled();

    act(() => stack.result.current());
    expect(close).toHaveBeenCalledTimes(1);
    act(() => stack.result.current());
    expect(open).toHaveBeenCalledTimes(1);
  });
});
