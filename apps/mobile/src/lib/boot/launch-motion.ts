/** After the splash: glide into Server address, or fade to the screen underneath. */
export type LaunchHandoff = "glide" | "fade";

/**
 * How the splash leaves once its hold ends; `null` holds it until the boot phase decides.
 * A glide needs Server address's measured brand, so without one the splash fades.
 */
export function resolveLaunchMotion(
  handoff: LaunchHandoff | null,
  reduceMotion: boolean,
  target: number | null
): LaunchHandoff | null {
  if (handoff === null) return null;

  return handoff === "glide" && !reduceMotion && target !== null ? "glide" : "fade";
}

/** The most one frame moves the launch clock: two 60 Hz frames. */
const MAX_LAUNCH_STEP = 1000 / 30;

/**
 * The launch clock after a frame: forward by the frame's time, capped so a frame stalled on
 * the first mount can't skip the slogan's fade, and never past `stop`.
 */
export function stepLaunchClock(clock: number, elapsed: number | null, stop: number) {
  "worklet";

  if (clock >= stop) return clock;

  return Math.min(clock + Math.min(elapsed ?? 0, MAX_LAUNCH_STEP), stop);
}

/**
 * Where the slogan's fade starts on the launch clock: once the device's messages are in, so it
 * is never seen changing language, and at `latest` anyway, so it is in by the hold's end.
 */
export function resolveSloganStart(
  start: number | null,
  clock: number,
  ready: boolean,
  latest: number
): number | null {
  "worklet";

  if (start !== null) return start;

  return ready || clock >= latest ? Math.min(clock, latest) : null;
}

/** Where the launch is: the splash still opaque, fading or gliding away, or gone. */
export type LaunchPhase = "covered" | "leaving" | "done";
