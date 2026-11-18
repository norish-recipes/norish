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
  it("opens once its sheet has gone, once for a double tap", () => {
    const { openAfterSheet, useSheetExit, useSheetPresenting } = releaseAfterSheet();
    const stack = renderHook(() => useSheetExit());
    const sheet = renderHook(() => useSheetPresenting());
    const close = vi.fn();
    const open = vi.fn();

    act(() => stack.result.current());
    expect(openAfterSheet(sheet.result.current, close, open)).toBe(true);
    expect(openAfterSheet(sheet.result.current, close, open)).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);

    sheet.unmount();
    act(() => stack.result.current());
    act(() => stack.result.current());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("closes a sheet tapped mid-presentation once it is up, then opens", () => {
    const { openAfterSheet, useSheetExit, useSheetPresenting } = releaseAfterSheet();
    const stack = renderHook(() => useSheetExit());
    const sheet = renderHook(() => useSheetPresenting());
    const close = vi.fn();
    const open = vi.fn();

    openAfterSheet(sheet.result.current, close, open);
    expect(close).not.toHaveBeenCalled();

    act(() => stack.result.current());
    expect(close).toHaveBeenCalledTimes(1);
    sheet.unmount();
    act(() => stack.result.current());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("drops a mid-presentation tap when the sheet is swiped away before it is up", () => {
    const { openAfterSheet, useSheetExit, useSheetPresenting } = releaseAfterSheet();
    const stack = renderHook(() => useSheetExit());
    const sheet = renderHook(() => useSheetPresenting());
    const close = vi.fn();
    const open = vi.fn();

    openAfterSheet(sheet.result.current, close, open);
    sheet.unmount();
    act(() => stack.result.current());
    act(() => stack.result.current());
    expect(close).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("opens only on a transition after its own sheet has gone", () => {
    const { openAfterSheet, useSheetExit, useSheetPresenting } = releaseAfterSheet();
    const stack = renderHook(() => useSheetExit());
    const sheet = renderHook(() => useSheetPresenting());
    const open = vi.fn();

    act(() => stack.result.current());
    openAfterSheet(sheet.result.current, vi.fn(), open);
    // Another root transition finishing while the sheet is still mounted.
    act(() => stack.result.current());
    expect(open).not.toHaveBeenCalled();

    sheet.unmount();
    act(() => stack.result.current());
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("leaves a tap to its own sheet: a second sheet's mount and unmount neither close nor drop it", () => {
    const { openAfterSheet, useSheetExit, useSheetPresenting } = releaseAfterSheet();
    const stack = renderHook(() => useSheetExit());
    const first = renderHook(() => useSheetPresenting());
    const close = vi.fn();
    const open = vi.fn();

    openAfterSheet(first.result.current, close, open);
    const second = renderHook(() => useSheetPresenting());

    // The second sheet's presentation ends: not the first's, so its close still waits.
    act(() => stack.result.current());
    expect(close).not.toHaveBeenCalled();
    second.unmount();
    act(() => stack.result.current());
    expect(open).not.toHaveBeenCalled();

    first.unmount();
    act(() => stack.result.current());
    expect(close).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
  it("reports a waiting open from the tap until it runs, and until it is dropped", () => {
    const { openAfterSheet, useSheetExit, useSheetOpenWaiting, useSheetPresenting } =
      releaseAfterSheet();
    const stack = renderHook(() => useSheetExit());
    const renders = vi.fn();
    const waiting = renderHook(() => {
      renders();

      return useSheetOpenWaiting();
    });
    const sheet = renderHook(() => useSheetPresenting());

    expect(waiting.result.current).toBe(false);
    act(() => stack.result.current());
    act(() => void openAfterSheet(sheet.result.current, vi.fn(), vi.fn()));
    expect(waiting.result.current).toBe(true);

    // Unmounted after its close: still waiting for the dismissal to finish.
    sheet.unmount();
    expect(waiting.result.current).toBe(true);
    act(() => stack.result.current());
    expect(waiting.result.current).toBe(false);

    // Swiped away before it was up: the drop clears it.
    const swiped = renderHook(() => useSheetPresenting());

    act(() => void openAfterSheet(swiped.result.current, vi.fn(), vi.fn()));
    expect(waiting.result.current).toBe(true);
    swiped.unmount();
    expect(waiting.result.current).toBe(false);

    // The stack unmounting, as on sign-out, clears it too.
    const reset = renderHook(() => useSheetPresenting());

    act(() => void openAfterSheet(reset.result.current, vi.fn(), vi.fn()));
    expect(waiting.result.current).toBe(true);
    stack.unmount();
    expect(waiting.result.current).toBe(false);
    // One render per change: on at the tap, off at each of the open, the drop and the reset.
    expect(renders).toHaveBeenCalledTimes(7);
  });
});
