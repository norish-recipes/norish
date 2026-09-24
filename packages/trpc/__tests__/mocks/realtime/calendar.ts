/** Mock for @norish/shared-server/realtime/calendar */
import { calendarRealtime } from "@norish/shared/contracts/realtime/calendar";

import { createFakeRealtimeDomain } from "../realtime";

export const calendar = createFakeRealtimeDomain(calendarRealtime);
