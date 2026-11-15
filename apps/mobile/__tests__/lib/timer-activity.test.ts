import type { TimerActivityPlan, TimerActivityProps } from "@/lib/timer-activity-state";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Fake = { update: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };

const native = vi.hoisted(() => ({
  instances: [] as Fake[],
  start: vi.fn(),
}));

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
});
