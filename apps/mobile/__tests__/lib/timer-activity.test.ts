import type {
  TimerActivityPlan,
  TimerActivityProps,
  TimerActivityRow,
} from "@/lib/timer-activity-state";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fake = { update: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };

const native = vi.hoisted(() => ({
  instances: [] as Fake[],
  start: vi.fn(),
}));

const warn = vi.hoisted(() => vi.fn());
vi.mock("@norish/shared/lib/logger", () => ({ createClientLogger: () => ({ warn }) }));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@expo/ui/swift-ui", () => ({}));
vi.mock("@expo/ui/swift-ui/modifiers", () => ({}));
vi.mock("expo-linking", () => ({}));
vi.mock("expo-widgets", () => ({
  createLiveActivity: () => ({
    getInstances: () => native.instances,
    start: native.start,
  }),
}));

const { syncTimerActivity } = await import("@/lib/timer-activity");

const props = (url: string): TimerActivityProps => ({
  rows: [],
  more: null,
  pausedLabel: "Paused",
  doneLabel: "Done",
  url,
});
const show = (
  url: string,
  staleAt: number | null = null,
  running: string[] = ["t1"]
): TimerActivityPlan => ({ kind: "show", props: props(url), staleAt, running });
const fake = (): Fake => ({ update: vi.fn(async () => {}), end: vi.fn(async () => {}) });

describe("syncTimerActivity", () => {
  beforeEach(async () => {
    native.instances = [];
    native.start.mockReset();
    warn.mockClear();
    // Clears the last pushed plan between tests.
    await syncTimerActivity({ kind: "end" });
  });

  it("starts one activity when none runs, with its stale date", async () => {
    await syncTimerActivity(show("a", 5_000));

    expect(native.start).toHaveBeenCalledWith(props("a"), undefined, new Date(5_000));
  });

  it("updates the running activity and skips a plan it already shows", async () => {
    const activity = fake();

    native.instances = [activity];
    await syncTimerActivity(show("a"));
    await syncTimerActivity(show("a"));
    await syncTimerActivity(show("b"));

    expect(activity.update.mock.calls).toEqual([
      [props("a"), undefined],
      [props("b"), undefined],
    ]);
    expect(native.start).not.toHaveBeenCalled();
  });

  it("ends a second activity a crash left behind at once and keeps the first", async () => {
    const kept = fake();
    const stray = fake();

    native.instances = [kept, stray];
    await syncTimerActivity(show("a"));

    expect(stray.end).toHaveBeenCalledWith("immediate");
    expect(kept.update).toHaveBeenCalled();
  });

  it("ends showing Done for iOS to clear, and at once when nothing is left", async () => {
    const done = fake();

    native.instances = [done];
    await syncTimerActivity({ kind: "done", props: props("a") });
    expect(done.end).toHaveBeenCalledWith("default", props("a"));

    const gone = fake();

    native.instances = [gone];
    await syncTimerActivity({ kind: "end" });
    expect(gone.end).toHaveBeenCalledWith("immediate");
  });

  it("starts nothing for Done when no activity runs", async () => {
    await syncTimerActivity({ kind: "done", props: props("a") });

    expect(native.start).not.toHaveBeenCalled();
  });

  it("pushes again after an end, so the next first timer starts a new activity", async () => {
    await syncTimerActivity(show("a"));
    native.instances = [fake()];
    await syncTimerActivity({ kind: "end" });
    native.instances = [];
    await syncTimerActivity(show("a"));

    expect(native.start).toHaveBeenCalledTimes(2);
  });

  it("leaves an activity the user swiped away gone until a timer starts", async () => {
    await syncTimerActivity(show("a", null, ["t1"]));
    // Swiped away: iOS no longer lists it. An adjust, then a pause, start nothing.
    await syncTimerActivity(show("b", null, ["t1"]));
    await syncTimerActivity(show("c", null, []));
    expect(native.start).toHaveBeenCalledTimes(1);

    // Resuming the paused one is a start.
    await syncTimerActivity(show("d", null, ["t1"]));
    expect(native.start).toHaveBeenCalledTimes(2);
  });

  it("starts nothing on the first sync after a launch, when iOS lists no activity", async () => {
    vi.resetModules();
    const fresh = await import("@/lib/timer-activity");

    await fresh.syncTimerActivity(show("a"));

    expect(native.start).not.toHaveBeenCalled();
  });

  it("logs and resolves when Live Activities are off and start throws", async () => {
    native.start.mockImplementation(() => {
      throw new Error("Live Activities are not enabled");
    });

    await expect(syncTimerActivity(show("a"))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    native.start.mockReset();
    await syncTimerActivity(show("a", null, ["t2"]));
    expect(native.start).toHaveBeenCalledTimes(1);
  });

  it("starts on the next sync of the same plan after a start that failed", async () => {
    native.start.mockImplementationOnce(() => {
      throw new Error("Live Activities are not enabled");
    });
    await syncTimerActivity(show("a", null, ["t1"]));
    // Live Activities turned on, then a foreground resync of the same timers.
    await syncTimerActivity(show("a", null, ["t1"]));

    expect(native.start).toHaveBeenCalledTimes(2);
  });

  it("pushes a running row once while its end holds, and again when the end moves", async () => {
    const activity = fake();
    const row = (startsAt: number, endsAt: number): TimerActivityRow => ({
      id: "t1",
      recipe: "Soup",
      step: "Step 1",
      state: "running",
      startsAt,
      endsAt,
    });
    const at = (startsAt: number, endsAt: number): TimerActivityPlan => ({
      kind: "show",
      props: { ...props("a"), rows: [row(startsAt, endsAt)] },
      staleAt: endsAt,
      running: ["t1"],
    });

    native.instances = [activity];
    // A 60 s timer adjusted past its duration: the start follows now until the end moves.
    await syncTimerActivity(at(10_000, 80_000));
    await syncTimerActivity(at(15_000, 80_000));
    await syncTimerActivity(at(20_000, 90_000));

    expect(activity.update.mock.calls.map(([pushed]) => pushed.rows)).toEqual([
      [row(10_000, 80_000)],
      [row(20_000, 90_000)],
    ]);
  });
});
