import { createClientLogger } from "@norish/shared/lib/logger";

import type { TimerStatus } from "./timer-types";

const logger = createClientLogger("timer-live-activity");

// ─── Factory (loaded once at module init) ────────────────────────────────────

let _liveActivityInstance: any = null;

const timerActivityFactory = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/widgets/TimerActivity").default;
  } catch {
    return null;
  }
})();

// ─── Start / update ──────────────────────────────────────────────────────────

export async function startOrUpdateLiveActivity(
  topTimer: { label: string; remainingMs: number; status: TimerStatus },
  totalCount: number
): Promise<void> {
  if (!timerActivityFactory) return;

  const props = {
    timerLabel: topTimer.label,
    remainingSeconds: Math.ceil(topTimer.remainingMs / 1000),
    status: topTimer.status,
    timerCount: totalCount,
  };

  if (_liveActivityInstance) {
    try {
      await _liveActivityInstance.update(props);
    } catch {
      // Activity was ended by the system — start a fresh one
      _liveActivityInstance = null;
      try {
        _liveActivityInstance = timerActivityFactory.start(props);
      } catch (err) {
        logger.warn(err, "Live Activity restart failed");
      }
    }
  } else {
    try {
      _liveActivityInstance = timerActivityFactory.start(props);
    } catch (err) {
      logger.warn(err, "Live Activity start failed");
    }
  }
}

// ─── End ─────────────────────────────────────────────────────────────────────

export async function endLiveActivity(): Promise<void> {
  try {
    if (_liveActivityInstance) {
      await _liveActivityInstance.end("default");
      _liveActivityInstance = null;
    }
  } catch (err) {
    logger.warn(err, "Live Activity end failed");
  }
}
