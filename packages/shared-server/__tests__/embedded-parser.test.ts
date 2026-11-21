// @vitest-environment node
/**
 * The embedded parser's life: started by the first import that needs it, shared by concurrent
 * ones, stopped once idle, and started again by the next. The process and its port are fakes.
 */
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock("node:child_process", () => ({ spawn: spawnMock }));
vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  existsSync: () => true,
}));
vi.mock("@norish/shared-server/logger", () => ({
  parserLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/** Whether anything answers the parser's port. */
let listening = false;

function fakeChild(pid: number) {
  const child = Object.assign(new EventEmitter(), {
    pid,
    stdout: null,
    stderr: null,
    kill: vi.fn(),
  });

  // Up once spawned; gone once signalled.
  listening = true;

  return child;
}

let children: ReturnType<typeof fakeChild>[];

async function load() {
  vi.resetModules();

  return import("../src/embedded-parser");
}

beforeEach(() => {
  listening = false;
  children = [];
  spawnMock.mockImplementation(() => {
    const child = fakeChild(1000 + children.length);

    children.push(child);

    return child;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (!listening) throw new Error("ECONNREFUSED");

      return new Response("{}", { status: 200 });
    })
  );
  vi.spyOn(process, "kill").mockImplementation((pid) => {
    const child = children.find((each) => each.pid === -Number(pid));

    listening = false;
    child?.emit("exit", 0, "SIGTERM");

    return true;
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the embedded parser", () => {
  it("starts on the first import, once for imports that arrive together, not before", async () => {
    const { embeddedParserState, withEmbeddedParser } = await load();

    expect(embeddedParserState()).toBe("idle");
    await Promise.all([withEmbeddedParser(async () => 1), withEmbeddedParser(async () => 2)]);

    expect(spawnMock).toHaveBeenCalledOnce();
    expect(embeddedParserState()).toBe("running");
  });

  it("stops once idle for the idle time, and the next import starts it again", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { embeddedParserState, PARSER_IDLE_STOP_MS, withEmbeddedParser } = await load();

    await withEmbeddedParser(async () => undefined);
    await vi.advanceTimersByTimeAsync(PARSER_IDLE_STOP_MS - 1);
    expect(embeddedParserState()).toBe("running");

    await vi.advanceTimersByTimeAsync(1);
    expect(embeddedParserState()).toBe("idle");
    expect(process.kill).toHaveBeenCalledWith(-1000, "SIGTERM");

    await withEmbeddedParser(async () => undefined);
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });

  it("is not stopped while an import is still using it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { embeddedParserState, PARSER_IDLE_STOP_MS, withEmbeddedParser } = await load();
    let finish = () => {};
    const long = withEmbeddedParser(() => new Promise<void>((done) => (finish = done)));

    await withEmbeddedParser(async () => undefined);
    await vi.advanceTimersByTimeAsync(PARSER_IDLE_STOP_MS * 2);
    expect(embeddedParserState()).toBe("running");

    finish();
    await long;
    await vi.advanceTimersByTimeAsync(PARSER_IDLE_STOP_MS);
    expect(embeddedParserState()).toBe("idle");
  });

  it("uses a parser already answering on the port and starts none", async () => {
    listening = true;
    const { embeddedParserState, withEmbeddedParser } = await load();

    await withEmbeddedParser(async () => undefined);

    expect(spawnMock).not.toHaveBeenCalled();
    expect(embeddedParserState()).toBe("external");
  });

  it("starts it again after it exited on its own", async () => {
    const { embeddedParserState, withEmbeddedParser } = await load();

    await withEmbeddedParser(async () => undefined);
    listening = false;
    children[0]!.emit("exit", 1, null);
    expect(embeddedParserState()).toBe("idle");

    await withEmbeddedParser(async () => undefined);
    expect(spawnMock).toHaveBeenCalledTimes(2);
  });
});
