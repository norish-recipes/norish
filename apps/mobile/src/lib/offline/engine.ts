// The shared offline engine over MMKV (ADR-0001); the Warm Set keeps data only, no images yet.

import { createMMKV } from "react-native-mmkv";
import { getBackendBaseUrl } from "@/lib/network/backend-base-url";
import Constants from "expo-constants";

import { createOfflineEngine, HEALTH_PROBE_PATH } from "@norish/shared-react/offline";
import { addWeeks, dateKey, getWeekEnd, getWeekStart } from "@norish/shared/lib/helpers";

import { createMmkvStorage } from "./mmkv-storage";
import { uploadFiles } from "./upload-files";

/** Marks the app's replays in server logs. */
export const OUTBOX_REPLAY_HEADER_VALUE = "mobile-outbox";

export const offlineEngine = createOfflineEngine({
  storage: createMmkvStorage({ mmkv: createMMKV({ id: "norish-offline" }), files: uploadFiles }),
  replayHeaderValue: OUTBOX_REPLAY_HEADER_VALUE,
  probeUrl: () => `${getBackendBaseUrl()}${HEALTH_PROBE_PATH}`,
  buster: Constants.expoConfig?.version,
  // The phone calendar's opening window: two weeks either side of this week.
  calendarRanges: () => {
    const now = new Date();

    return [
      {
        startISO: dateKey(getWeekStart(addWeeks(now, -2))),
        endISO: dateKey(getWeekEnd(addWeeks(now, 2))),
      },
    ];
  },
});
